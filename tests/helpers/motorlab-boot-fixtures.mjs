import {readFile} from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
// Keep historical release-pin tests compatible with the current full-suite
// bootstrap safety contract. Do not weaken the actual production guard.
async function fixture(path, release) {
  const source=await readFile(new URL(path, root), 'utf8');
  if (!/^RELEASE=\d{4}\.\d{2}\.\d{2}-r\d+$/m.test(source)) throw Error('Missing release marker');
  return source.replace(/^RELEASE=.*$/m, 'RELEASE='+release);
}
export const capsuleFor=(release)=>fixture('MOTORLAB_BOOT_CAPSULE_V1.txt',release);
export const coreFor=(release)=>fixture('MOTORLAB_SATELLITE_BUNDLE_V1.txt',release);
