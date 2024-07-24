const fs = require("fs")
const { WebSocketManager, WebSocketShardEvents, CompressionMethod } = require("@discordjs/ws")
const { REST } = require("@discordjs/rest")
const { spawnSync } = require("child_process")
const Jimp = require("jimp")

const WAITED_LONG_ENOUGH_MS = 5000

const { writeFile } = require("fs/promises")
function downloadFile(url, outputPath) {
    return fetch(url)
        .then((x) => x.arrayBuffer())
        .then((x) => writeFile(outputPath, Buffer.from(x)))
}

const getSoundboards = async (bot) => {
    return new Promise((resolve, reject) => {
        let servers = []

        const rest = new REST().setToken(bot.token)
        // This example will spawn Discord's recommended shard count, all under the current process.
        const manager = new WebSocketManager({
            token: bot.token,
            intents: 1,
            rest
            // uncomment if you have zlib-sync installed and want to use compression
            // compression: CompressionMethod.ZlibSync,

            // alternatively, we support compression using node's native `node:zlib` module:
            // compression: CompressionMethod.ZlibNative,
        })

        manager.on(WebSocketShardEvents.Dispatch, (event) => {
            if (event.data.t == "GUILD_CREATE") {
                if (event.data.d?.soundboard_sounds && event.data.d?.soundboard_sounds.length > 0) {
                    let server = {
                        name: event.data.d.name,
                        id: event.data.d.id,
                        icon: event.data.d.icon,
                        iconURL: `https://cdn.discordapp.com/icons/${event.data.d.id}/${event.data.d.icon}.png`,
                        sounds: []
                    }
                    console.log(`[${bot.name}] Found: ${event.data.d.name} (${event.data.d.soundboard_sounds.length} sounds)`)
                    for (let sound of event.data.d.soundboard_sounds) {
                        server.sounds.push(sound)
                    }
                    servers.push(server)
                }
            }
        })

        setTimeout(() => {
            manager.destroy()
            resolve(servers)
        }, WAITED_LONG_ENOUGH_MS)

        manager.connect()
    })
}

const mkdir = (dir) => {
    try {
        fs.mkdirSync(dir)
    } catch (e) {
        // who cares
    }
}

const makeTextImage = (text, outputFilename) => {
    return new Promise((resolve, reject) => {
        const W = 400
        const H = 225
        const img = new Jimp(W, H, 'black')
        Jimp.loadFont(Jimp.FONT_SANS_32_WHITE).then((font) => {
            img.print(font, 0, 0, {
                text: text,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
            }, W, H)
            return img
        }).then((img) => {
            img.writeAsync(outputFilename).then(() => {
                resolve(true)
            })
        })
    })
}

const main = async () => {
    let config = JSON.parse(fs.readFileSync("harvest.json", "utf8"))

    let promises = []
    for (let bot of config.bots) {
        promises.push(getSoundboards(bot))
    }
    const results = await Promise.all(promises)

    let servers = []
    let seen = {}
    for (const result of results) {
        for (let server of result) {
            if (!seen[server.id]) {
                seen[server.id] = true
                servers.push(server)
            }
        }
    }

    servers.sort((a, b) => {
        if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1
        }
        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1
        }
        return 0
    })

    mkdir("./web/sounds")
    mkdir("./web/icons")

    // console.log(servers)

    console.log("Downloading sounds...")
    for (const server of servers) {
        const iconFilename = `./web/icons/${server.id}.png`
        if (!fs.existsSync(iconFilename)) {
            console.log(`Downloading: ${server.iconURL} (${server.name})`)
            await downloadFile(server.iconURL, iconFilename)
        } else {
            console.log(`Skipping: Icon (${server.name})`)
        }

        for (const sound of server.sounds) {
            const soundFilename = `./web/sounds/${sound.sound_id}.ogg`
            if (!fs.existsSync(soundFilename)) {
                const soundURL = `https://cdn.discordapp.com/soundboard-sounds/${sound.sound_id}`

                console.log(`Downloading: ${soundURL} (${sound.name})`)
                await downloadFile(soundURL, soundFilename)
            } else {
                console.log(`Skipping: (${sound.name})`)
            }

            const wavFilename = `./web/sounds/${sound.sound_id}.wav`
            if (!fs.existsSync(wavFilename)) {
                console.log(`Converting: ${wavFilename}`)
                spawnSync("ffmpeg", ["-i", soundFilename, wavFilename], { stdio: "inherit" })
            }

            const mp3Filename = `./web/sounds/${sound.sound_id}.mp3`
            if (!fs.existsSync(mp3Filename)) {
                console.log(`Converting: ${mp3Filename}`)
                spawnSync("ffmpeg", ["-i", soundFilename, mp3Filename], { stdio: "inherit" })
            }

            const mp4Filename = `./web/sounds/${sound.sound_id}.mp4`
            if (!fs.existsSync(mp4Filename)) {
                const lole = await makeTextImage(sound.name, "tmp.png")
                console.log(`Converting: ${mp4Filename}`)
                spawnSync("ffmpeg", ["-loop", "1", "-i", "tmp.png", "-i", soundFilename, "-shortest", mp4Filename], { stdio: "inherit" })
                fs.unlinkSync("tmp.png")
            }
        }
    }
    fs.writeFileSync("servers.json", JSON.stringify(servers, null, 2))
    console.log("Wrote: servers.json")
}

main()
