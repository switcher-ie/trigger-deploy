import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'dist', 'index.js')
  const options: cp.ExecFileSyncOptions = {
    env: Object.assign(process.env, {
      INPUT_GITHUB_ACCESS_TOKEN: '0000000000000000000000000000000000000000'
    })
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})
