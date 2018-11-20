const mysql = require('sync-mysql')
const asyncMySQL = require('mysql')
const bc = require('node-php-password')

var con = asyncMySQL.createConnection({
    host: "localhost",
    user: "kyouko",
    password: "AlZd4bY8S9IjCqgd",
    database: "kyouko"
})

var conn = new mysql({
    host: "localhost",
    user: "kyouko",
    password: "AlZd4bY8S9IjCqgd",
    database: "kyouko"
})

function login(username, password) {
    if (username == "anonymous") {
        limit = 100
        return true
    } else {
        q = "SELECT * FROM accounts WHERE email=" + con.escape(username)
        const res = conn.query(q)
        if (res[0] != null) {
            var bcRes = bc.verify(password, res[0]["pass"])
            //var bcRes = bc.compareSync(password, res[0]["pass"])
            if (bcRes == true) {
                var authLevel = res[0]["level"]
                if (String(authLevel) == "0") {
                    limit = 200
                    console.log("set limit")
                } else if (String(authLevel) == "0.1") {
                    limit = 400
                } else if (String(authLevel) == "1000") {
                    limit = 1000
                }
                return true
            } else {
                return false
            }
        } else {
            return false
        }
    }
}
module.exports = {
    login
}