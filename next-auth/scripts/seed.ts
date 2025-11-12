import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { hash } from 'argon2';

async function main() {
  const email = process.env.FOUNDER_EMAIL || 'founder@newspulse.co.in';
  const password = process.env.FOUNDER_PASSWORD || 'ChangeMe_Strong!';
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log('Founder already exists:', exists.id);
    return;
  }
  const passwordHash = await hash(password, { type: 2 }); // argon2id
  const user = await prisma.user.create({ data: { email, passwordHash, role: 'FOUNDER', status: 'ACTIVE' } });
  await prisma.mfa.create({ data: { userId: user.id, enabled: false, recoveryCodes: [] } });
  console.log('Seeded founder:', user.id);
}

main().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1); });