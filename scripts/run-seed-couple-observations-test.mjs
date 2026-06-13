#!/usr/bin/env node
/**
 * テストカップルに観察レポート + 具体メモを投入する。
 *
 * 前提: scripts/apply-cached-couple-observations.sql 適用済み（recent_notices 列）
 *
 * 使い方:
 *   node scripts/run-seed-couple-observations-test.mjs
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const EMAIL_A = "aoyk.ooiooi@gmail.com";
const EMAIL_B = "meiyuegaoshan@gmail.com";

const RECENT_NOTICES = [
  { emoji: "💬", label: "最近は気持ちを確認したい話題が増えている" },
  { emoji: "🏠", label: "住まいについて具体的な話が増えている" },
  { emoji: "🐶", label: "ペットとの生活を想像する会話が増えてきた" },
];

async function findUserIdByEmail(supabase, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function seedDirect(supabase) {
  const userA = await findUserIdByEmail(supabase, EMAIL_A);
  const userB = await findUserIdByEmail(supabase, EMAIL_B);

  if (!userA || !userB) {
    throw new Error(`test users not found (${EMAIL_A} / ${EMAIL_B})`);
  }

  const { data: memberA, error: memberAError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userA)
    .maybeSingle();

  if (memberAError) throw memberAError;

  const { data: memberB, error: memberBError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userB)
    .maybeSingle();

  if (memberBError) throw memberBError;

  if (!memberA?.couple_id || memberA.couple_id !== memberB?.couple_id) {
    throw new Error("test users are not in the same couple");
  }

  const coupleId = memberA.couple_id;
  const now = new Date();

  const [{ data: profileA }, { data: profileB }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userA).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userB).maybeSingle(),
  ]);

  const nameA = profileA?.display_name?.trim() || "あなた";
  const nameB = profileB?.display_name?.trim() || "パートナー";

  await supabase
    .from("partner_memos")
    .delete()
    .eq("couple_id", coupleId)
    .in("user_id", [userA, userB]);

  const memoRows = [
    { user_id: userA, couple_id: coupleId, content: "小春は家族として大切にしている", created_at: hoursAgo(now, 48) },
    { user_id: userA, couple_id: coupleId, content: "週末は一緒にゲームを楽しみたい", created_at: hoursAgo(now, 24) },
    { user_id: userA, couple_id: coupleId, content: "沖縄の海に行きたい", created_at: hoursAgo(now, 6) },
    { user_id: userB, couple_id: coupleId, content: "焼肉デートが好き", created_at: hoursAgo(now, 48) },
    { user_id: userB, couple_id: coupleId, content: "一緒の時間を大切にしたい", created_at: hoursAgo(now, 24) },
    { user_id: userB, couple_id: coupleId, content: "水族館もデート先にしたい", created_at: hoursAgo(now, 5) },
  ];

  const { error: memoError } = await supabase.from("partner_memos").insert(memoRows);
  if (memoError) throw memoError;

  const traitsRow = {
    couple_id: coupleId,
    self_traits: {
      user_id: userA,
      name: nameA,
      traits: [
        "実家の柴犬・小春が大好き。",
        "嬉しいことも不安なことも素直に感じる、",
        "感情豊かな女の子。",
      ],
    },
    partner_traits: {
      user_id: userB,
      name: nameB,
      traits: [
        "将来のことを考えるのが好き。",
        "少し慎重だけど、",
        "大切な人のためには行動できる男の子。",
      ],
    },
    generated_at: now.toISOString(),
    source_summary: {
      prompt_version: "smile_intro_v2",
      observations_prompt_version: "observation_v1",
      seed: "couple_observations_test_v1",
    },
    model: "seed",
    recent_notices: RECENT_NOTICES,
    observations_generated_at: now.toISOString(),
    observations_model: "seed",
    updated_at: now.toISOString(),
  };

  const { error: traitsError } = await supabase
    .from("cached_couple_traits")
    .upsert(traitsRow, { onConflict: "couple_id" });

  if (traitsError) throw traitsError;

  return {
    couple_id: coupleId,
    user_a: userA,
    user_b: userB,
    memos_inserted: memoRows.length,
    recent_notices: RECENT_NOTICES,
    message: "seed complete — open /home and /couple as either test user",
  };
}

function hoursAgo(base, hours) {
  return new Date(base.getTime() - hours * 60 * 60 * 1000).toISOString();
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: rpcError } = await supabase.rpc("seed_couple_observations_test_data");

  if (!rpcError) {
    console.log("seed ok (rpc)");
    console.log("\n次のステップ:");
    console.log(`- ${EMAIL_A} で /home → 覚えていること`);
    console.log("- /couple → 気づいたこと（AI REPORT）");
    return;
  }

  if (!rpcError.message.includes("Could not find the function")) {
    console.error("seed failed (rpc):", rpcError.message);
    process.exit(1);
  }

  try {
    const data = await seedDirect(supabase);
    console.log("seed ok (direct):", JSON.stringify(data, null, 2));
    console.log("\n次のステップ:");
    console.log(`- ${EMAIL_A} で /home → 覚えていること（メモタグ）`);
    console.log("- どちらかのユーザーで /couple → 気づいたこと（AI REPORT）");
  } catch (err) {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    if (err instanceof Error && /recent_notices|column/.test(err.message)) {
      console.error(
        "\n→ 先に Supabase SQL Editor で scripts/apply-cached-couple-observations.sql を実行してください"
      );
    }
    process.exit(1);
  }
}

main();
