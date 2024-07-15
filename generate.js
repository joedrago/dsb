const fs = require("fs")

const main = () => {
    const servers = JSON.parse(fs.readFileSync("servers.json", "utf8"))

    servers.sort((a, b) => {
        if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1
        }
        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1
        }
        return 0
    })

    let html = `<html>
<head>
<title>Discord Soundboard</title>
<link rel="stylesheet" href="index.css">
</head>
<body>
<script>
let currentSound = null
const playSound = (url) => {
  if(currentSound) {
    currentSound.pause()
  }
  currentSound = new Audio(url)
  currentSound.play()
}
</script>
<center>
`
    for (const server of servers) {
        server.sounds.sort((a, b) => {
            if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1
            }
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1
            }
            return 0
        })

        html += `
<div class="server">
<div class="servername"><img class="servericon" src="icons/${server.id}.png"> ${server.name}</div>
`
        for (const sound of server.sounds) {
            html += `
<div class="soundline"><div class="sound" onclick="playSound('sounds/${sound.sound_id}.ogg')">${sound.name}</div></div>
`
        }

        html += `
</div>
`
    }

    html += `
</center>
</body>
</html
`
    fs.writeFileSync("web/index.html", html)
}

main()
