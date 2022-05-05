const mysql = require('sync-mysql')
const asyncMySQL = require('mysql')
const bc = require('node-php-password')

const con = asyncMySQL.createConnection({
    host: "localhost",
    user: "",
    password: "",
    database: ""
});

const conn = new mysql({
    host: "localhost",
    user: "",
    password: "",
    database: ""
});

function login(username, password) {
    let limit;
    let q;
    if (username === "anonymous") {
        limit = 100
        return true
    } else {
        q = "SELECT * FROM accounts WHERE email=" + con.escape(username)
        const res = conn.query(q)
        if (res[0] != null) {
            const bcRes = bc.verify(password, res[0]["pass"]);
            //var bcRes = bc.compareSync(password, res[0]["pass"])
            if (bcRes === true) {
                const authLevel = res[0]["level"];
                if (String(authLevel) === "0") {
                    limit = 200
                    console.log("set limit")
                } else if (String(authLevel) === "0.1") {
                    limit = 400
                } else if (String(authLevel) === "1000") {
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