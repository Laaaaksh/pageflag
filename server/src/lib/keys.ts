import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 24);

export function generatePublicKey(): string {
  return `pf_${generate()}`;
}

export function generateReviewToken(): string {
  return generate();
}
