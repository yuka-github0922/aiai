import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV（GCM 推奨）
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export type EncryptedPayload = {
  encrypted: string;  // base64
  iv:        string;  // base64
  authTag:   string;  // base64
};

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString("base64"),
    iv:        iv.toString("base64"),
    authTag:   cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * DB から取得したメッセージ行を復号する。
 * body_encrypted / body_iv / body_auth_tag が必須（body 列は廃止済み）。
 */
export function decryptMessageBody(row: {
  body_encrypted: string | null;
  body_iv:        string | null;
  body_auth_tag:  string | null;
}): string {
  if (!row.body_encrypted || !row.body_iv || !row.body_auth_tag) {
    console.error("decryptMessageBody: encrypted fields are missing", row);
    return "";
  }
  return decrypt({
    encrypted: row.body_encrypted,
    iv:        row.body_iv,
    authTag:   row.body_auth_tag,
  });
}
