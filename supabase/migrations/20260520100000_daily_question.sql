-- =============================================================================
-- AiAi「今日のふたり質問」
-- - 3テーブル + seed 1問 + RPC + RLS
-- - round_date は JST 0:00 基準
-- - 将来 timeline_events: source_type='daily_question_round', source_ref=round.id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS couple_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body          text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_question_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES couple_questions(id),
  round_date    date NOT NULL,
  revealed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_question_rounds_couple_date_unique UNIQUE (couple_id, round_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_question_rounds_couple_date
  ON daily_question_rounds (couple_id, round_date DESC);

CREATE TABLE IF NOT EXISTS daily_question_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES daily_question_rounds(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer        text,
  guess         text,
  answered_at   timestamptz,
  guessed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_question_responses_round_user_unique UNIQUE (round_id, user_id),
  CONSTRAINT daily_question_responses_answer_length CHECK (
    answer IS NULL OR char_length(trim(answer)) BETWEEN 1 AND 80
  ),
  CONSTRAINT daily_question_responses_guess_length CHECK (
    guess IS NULL OR char_length(trim(guess)) BETWEEN 1 AND 80
  )
);

CREATE INDEX IF NOT EXISTS idx_daily_question_responses_round
  ON daily_question_responses (round_id);

-- -----------------------------------------------------------------------------
-- 2. Seed（MVP: 1問固定）
-- -----------------------------------------------------------------------------

INSERT INTO couple_questions (id, body, is_active, display_order)
VALUES (
  'a0000000-0000-4000-a000-000000000001',
  '最近、相手に感謝したことは？',
  true,
  0
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_jst_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date;
$$;

CREATE OR REPLACE FUNCTION get_my_couple_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT couple_id
  FROM couple_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION couple_has_partner(p_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 2
  FROM couple_members
  WHERE couple_id = p_couple_id;
$$;

CREATE OR REPLACE FUNCTION touch_daily_question_response_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_question_responses_updated_at ON daily_question_responses;
CREATE TRIGGER trg_daily_question_responses_updated_at
  BEFORE UPDATE ON daily_question_responses
  FOR EACH ROW
  EXECUTE FUNCTION touch_daily_question_response_updated_at();

-- -----------------------------------------------------------------------------
-- 4. ensure_daily_question_round
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_daily_question_round(p_couple_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id    uuid;
  v_question_id uuid;
  v_today       date := get_jst_today();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM couple_members
    WHERE couple_id = p_couple_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  SELECT id
  INTO v_round_id
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id
    AND round_date = v_today;

  IF v_round_id IS NOT NULL THEN
    RETURN v_round_id;
  END IF;

  SELECT id
  INTO v_question_id
  FROM couple_questions
  WHERE is_active = true
  ORDER BY display_order ASC, created_at ASC
  LIMIT 1;

  IF v_question_id IS NULL THEN
    RAISE EXCEPTION 'no active question';
  END IF;

  INSERT INTO daily_question_rounds (couple_id, question_id, round_date)
  VALUES (p_couple_id, v_question_id, v_today)
  RETURNING id INTO v_round_id;

  RETURN v_round_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. get_daily_question_state
--    ※ partner_answer / partner_guess は revealed まで返さない
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_daily_question_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id            uuid;
  v_round_id             uuid;
  v_question_body        text;
  v_revealed_at          timestamptz;
  v_my_user_id           uuid := auth.uid();
  v_partner_user_id      uuid;
  v_my_answer            text;
  v_my_guess             text;
  v_partner_answer       text;
  v_partner_guess        text;
  v_phase                text;
  v_result               jsonb;
BEGIN
  IF v_my_user_id IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_my_user_id
  LIMIT 1;

  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_round_id := ensure_daily_question_round(v_couple_id);

  SELECT q.body, r.revealed_at
  INTO v_question_body, v_revealed_at
  FROM daily_question_rounds r
  JOIN couple_questions q ON q.id = r.question_id
  WHERE r.id = v_round_id;

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_my_user_id
  LIMIT 1;

  SELECT answer, guess
  INTO v_my_answer, v_my_guess
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_my_user_id;

  SELECT answer, guess
  INTO v_partner_answer, v_partner_guess
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_partner_user_id;

  IF v_my_answer IS NULL THEN
    v_phase := 'needs_my_answer';
  ELSIF v_my_guess IS NULL THEN
    v_phase := 'needs_my_guess';
  ELSIF v_partner_answer IS NULL OR v_partner_guess IS NULL THEN
    v_phase := 'waiting_partner';
  ELSE
    v_phase := 'revealed';
    IF v_revealed_at IS NULL THEN
      UPDATE daily_question_rounds
      SET revealed_at = now()
      WHERE id = v_round_id
      RETURNING revealed_at INTO v_revealed_at;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'visible', true,
    'phase', v_phase,
    'question', v_question_body,
    'round_id', v_round_id
  );

  IF v_my_answer IS NOT NULL AND v_phase IN ('needs_my_guess', 'waiting_partner', 'revealed') THEN
    v_result := v_result || jsonb_build_object('my_answer', v_my_answer);
  END IF;

  IF v_phase = 'revealed' THEN
    v_result := v_result || jsonb_build_object(
      'my_guess', v_my_guess,
      'partner_answer', v_partner_answer,
      'partner_guess', v_partner_guess,
      'revealed_at', v_revealed_at
    );
  END IF;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. submit_daily_question_answer（送信後編集不可）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_daily_question_answer(p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id   uuid;
  v_round_id    uuid;
  v_user_id     uuid := auth.uid();
  v_trimmed     text;
  v_existing    text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_trimmed := trim(p_answer);
  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 80 THEN
    RAISE EXCEPTION 'answer length must be between 1 and 80';
  END IF;

  SELECT couple_id INTO v_couple_id FROM couple_members WHERE user_id = v_user_id LIMIT 1;
  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  v_round_id := ensure_daily_question_round(v_couple_id);

  SELECT answer
  INTO v_existing
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'answer already submitted';
  END IF;

  INSERT INTO daily_question_responses (round_id, user_id, answer, answered_at)
  VALUES (v_round_id, v_user_id, v_trimmed, now())
  ON CONFLICT (round_id, user_id) DO NOTHING;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. submit_daily_question_guess（送信後編集不可）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_daily_question_guess(p_guess text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id         uuid;
  v_round_id          uuid;
  v_user_id           uuid := auth.uid();
  v_partner_user_id   uuid;
  v_trimmed           text;
  v_updated           int;
  v_partner_answer    text;
  v_partner_guess     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_trimmed := trim(p_guess);
  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 80 THEN
    RAISE EXCEPTION 'guess length must be between 1 and 80';
  END IF;

  SELECT couple_id INTO v_couple_id FROM couple_members WHERE user_id = v_user_id LIMIT 1;
  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  v_round_id := ensure_daily_question_round(v_couple_id);

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_user_id
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_user_id
      AND answer IS NOT NULL
      AND guess IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot submit guess in current state';
  END IF;

  UPDATE daily_question_responses
  SET guess = v_trimmed,
      guessed_at = now()
  WHERE round_id = v_round_id
    AND user_id = v_user_id
    AND guess IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'guess already submitted';
  END IF;

  SELECT answer, guess
  INTO v_partner_answer, v_partner_guess
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_partner_user_id;

  IF v_partner_answer IS NOT NULL AND v_partner_guess IS NOT NULL THEN
    UPDATE daily_question_rounds
    SET revealed_at = COALESCE(revealed_at, now())
    WHERE id = v_round_id;
  END IF;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE couple_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_question_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_question_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS couple_questions_select_authenticated ON couple_questions;
CREATE POLICY couple_questions_select_authenticated
  ON couple_questions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS daily_question_rounds_select_own_couple ON daily_question_rounds;
CREATE POLICY daily_question_rounds_select_own_couple
  ON daily_question_rounds
  FOR SELECT
  TO authenticated
  USING (
    couple_id IN (
      SELECT couple_id
      FROM couple_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS daily_question_responses_select_own ON daily_question_responses;
CREATE POLICY daily_question_responses_select_own
  ON daily_question_responses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 書き込みは RPC (SECURITY DEFINER) 経由のみ

-- -----------------------------------------------------------------------------
-- 9. Grants
-- -----------------------------------------------------------------------------

GRANT SELECT ON couple_questions TO authenticated;
GRANT SELECT ON daily_question_rounds TO authenticated;
GRANT SELECT ON daily_question_responses TO authenticated;

GRANT EXECUTE ON FUNCTION get_jst_today() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_couple_id() TO authenticated;
GRANT EXECUTE ON FUNCTION couple_has_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_daily_question_round(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_question_state() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_daily_question_answer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_daily_question_guess(text) TO authenticated;
