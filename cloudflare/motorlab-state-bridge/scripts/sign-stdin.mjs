import { createHmac } from 'node:crypto';

const secret = process.env.MOTORLAB_RELAY_SECRET;
const timestamp = process.env.MOTORLAB_TIMESTAMP;
if (!secret || !timestamp) {
  console.error('MOTORLAB_RELAY_SECRET and MOTORLAB_TIMESTAMP are required');
  process.exit(2);
}
let body = '';
for await (const chunk of process.stdin) body += chunk;
process.stdout.write(createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'));
