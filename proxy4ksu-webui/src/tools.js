import {exec, spawn} from 'kernelsu'
import {Buffer} from 'buffer/'

export const XRAYHELPER = "/data/adb/xray/bin/xrayhelper"
export const XRAYHELPER_CONFIG = "/data/adb/xray/xrayhelper.yml"

export const execCmdWithExitCode = async (cmd) => {
    console.info(cmd)
    const {errno, stdout,stderr} = await exec(cmd, {cwd: '/'})
    if (errno === 0) {
        console.log(stdout)
    }else{
        console.log(stderr)
    }
    return errno
}
export const execCmd = async (cmd) => {
    console.info(cmd)
    const {errno, stdout} = await exec(cmd, {cwd: '/'})
    if (errno === 0) {
        // success
        console.log(stdout)
        return stdout
    }
}
export const execCmdWithError = async (cmd) => {
    console.info(cmd)
    const {errno, stdout, stderr} = await exec(cmd, {cwd: '/'})
    if (errno === 0) {
        // success
        console.log(stdout)
        return stdout
    } else {
        console.info(stderr)
        return `${stdout}\n${stderr}`
    }
}
export const readFile = async (filePath) => {
    return Buffer.from(await execCmd(`base64 -w 0 ${filePath}`), "base64").toString('utf-8')
}
export const saveFile = (content, filePath) => {
    return execCmd(`echo ${Buffer.from(content).toString("base64")} | base64 -d > ${filePath}`)
}
export const callApi = async (api) => {
    if (typeof api === "undefined") {
        api = []
    } else if (!(api instanceof Array)) {
        api = api.split(" ")
    }
    let params = ["-c", XRAYHELPER, "-c", XRAYHELPER_CONFIG, "-t", "3", "api"]
    params.push(...api)
    const timeoutMs = api[0] === "misc" && api[1] === "realping" ? 120000 : 10000
    return await new Promise((resolve, reject) => {
        let stdout = ""
        let stderr = ""
        let settled = false
        const process = spawn('su', params)
        const timeout = setTimeout(() => {
            if (settled) {
                return
            }
            settled = true
            reject(new Error(`API timeout: ${api.join(" ")}`))
        }, timeoutMs)
        const finish = (callback) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timeout)
            callback()
        }
        process.stdout.on('data', (data) => {
            stdout += data.toString()
        })
        if (process.stderr && process.stderr.on) {
            process.stderr.on('data', (data) => {
                stderr += data.toString()
            })
        }
        process.on('error', (error) => {
            finish(() => reject(error))
        })
        process.on('exit', () => {
            finish(() => {
                const output = stdout.trim()
                if (output === "") {
                    reject(new Error(stderr.trim() || `Empty API response: ${api.join(" ")}`))
                    return
                }
                try {
                    resolve(JSON.parse(output))
                } catch (error) {
                    const start = output.indexOf("{")
                    const end = output.lastIndexOf("}")
                    if (start >= 0 && end > start) {
                        try {
                            resolve(JSON.parse(output.slice(start, end + 1)))
                            return
                        } catch (_) {
                            // Fall through to the detailed error below.
                        }
                    }
                    reject(new Error(`Invalid API response: ${output.slice(0, 200)}`))
                }
            })
        })
    })
}
export const execXrayHelperCmd = (cmd) => {
    return execCmdWithError(`su -c ${XRAYHELPER} -c ${XRAYHELPER_CONFIG} -t 5 ${cmd}`)
}
