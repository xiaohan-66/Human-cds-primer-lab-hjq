import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for (const file of readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).sort()) {
  const result=spawnSync(process.execPath,['--import','./tests/register.mjs','--experimental-transform-types',`tests/${file}`],{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status??1);
}
