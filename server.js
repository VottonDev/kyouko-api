const expr = require('express')
const fUpload = require('express-fileupload')
const auth = require('./lib/auth.js')
const basicAuth = require('express-basic-auth')
const app = expr()
require('fs');
const port = 90

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(fUpload(undefined))
app.use(cookieParser())
app.use(basicAuth({
    authorizer: doLogin
}))

function doLogin(username, password) {
    return auth.login(username, password)
}

app.listen(port)

console.log('[LOADING] Router')
const r = require('./lib/router.js')
r.router(app)
