const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  return Array.from({ length: 16 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}
