#!/usr/bin/env node
/**
 * テストカップルにふたり質問3件を投入する。
 *
 * 前提: scripts/seed-couple-home-world-test-data.sql を Supabase SQL Editor で
 *       一度実行済み（seed_couple_home_world_test_data 関数が存在すること）
 *
 * 使い方:
 *   node scripts/run-seed-home-world-test.mjs
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

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

  const { data, error } = await supabase.rpc("seed_couple_home_world_test_data");

  if (error) {
    console.error("seed failed:", error.message);
    console.error(
      "\n→ 先に Supabase SQL Editor で scripts/seed-couple-home-world-test-data.sql を実行してください"
    );
    process.exit(1);
  }

  console.log("seed ok:", JSON.stringify(data, null, 2));
  console.log("\n次のステップ:");
  console.log("1. テストユーザーで /home を開く → placeholder + 裏で生成");
  console.log("2. 30〜60秒後に refresh → hero 画像");
}

main();
