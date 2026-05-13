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
    // NOTE: KernelSU's spawn API does not reliably fire the 'exit' event inside a
    // Promise constructor. Use the original polling approach instead.
    let result = {
        data: null,
        exited: false,
        error: null,
    }
    if (typeof api === "undefined") {
        api = []
    } else if (!(api instanceof Array)) {
        api = api.split(" ")
    }
    let params = ["-c", XRAYHELPER, "-c", XRAYHELPER_CONFIG, "-t", "3", "api"]
    params.push(...api)
    const timeoutMs = api[0] === "misc" && api[1] === "realping" ? 120000 : 60000
    let process = spawn('su', params)
    process.stdout.on('data', (data) => {
        const output = data.toString().trim()
        if (!output) return
        try {
            result.data = JSON.parse(output)
        } catch (_) {
            // Try to extract JSON if there's noise around it
            const start = output.indexOf("{")
            const end = output.lastIndexOf("}")
            if (start >= 0 && end > start) {
                try {
                    result.data = JSON.parse(output.slice(start, end + 1))
                    return
                } catch (__) {}
            }
            result.error = new Error(`Invalid API response: ${output.slice(0, 200)}`)
        }
    })
    process.on('exit', () => {
        result.exited = true
    })
    // Poll until the process exits or timeout
    const deadline = Date.now() + timeoutMs
    while (true) {
        if (result.exited) {
            if (result.error) throw result.error
            if (result.data === null) throw new Error(`Empty API response: ${api.join(" ")}`)
            return result.data
        }
        if (Date.now() > deadline) {
            throw new Error(`API timeout: ${api.join(" ")}`)
        }
        await new Promise(done => setTimeout(() => done(), 50))
    }
}
export const execXrayHelperCmd = (cmd) => {
    return execCmdWithError(`su -c ${XRAYHELPER} -c ${XRAYHELPER_CONFIG} -t 5 ${cmd}`)
}
