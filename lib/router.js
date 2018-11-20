const mysql = require('mysql')
const syncMySQL = require('sync-mysql')
const crypto = require('crypto')
var path = require('path')
var fs = require('fs')
var fileSignature = require('file-signature');
var aws = require('aws-sdk')
var md5 = require('md5-file')
var mime = require('mime-types')

/*var creds = new aws.SharedIniFileCredentials({
    profile: 'wasabi'
})
aws.config.credentials = creds */

aws.config.loadFromPath('lib/config.json');({
    aws_access_key_id: "BGWDJ03HPDDOVMSOINNK",
    aws_secret_access_key: "dUJ83y1Uq6QKCBcf8XGEWqbFerd459KPzMDDL19Q",
    region: 'us-west-2',
    profile: 'wasabi'
});

var ep = new aws.Endpoint('s3.wasabisys.com')
var s3 = new aws.S3({endpoint: ep})

console.log("[LOADING] MySQL")
var con = mysql.createConnection({
    host: "localhost",
    user: "kyouko",
    password: "AlZd4bY8S9IjCqgd",
    database: "kyouko"
})
var conn = new syncMySQL({
    host: "localhost",
    user: "kyouko",
    password: "AlZd4bY8S9IjCqgd",
    database: "kyouko"
})
  
con.connect(function(err) {
    if (err) throw err;
    console.log("[MYSQL] Connected");
    console.log('[READY]')
})

function buildQuery(startingQuery, colReference, valueArray, startNull) {
    var q = startingQuery
    var notNull = startNull
    for (var i = 0; i < valueArray.length; i++) {
        if (valueArray[i] != null) {
            if (!notNull) {
                q = q + "WHERE " + colReference[i] + " LIKE (" + valueArray[i] + ")"
                notNull = true
            } else {
                q = q + " AND " + colReference[i] + " LIKE (" + valueArray[i] + ")"
            }
        }
    }
    return q
}

// Check if the extension matches the file's magic numbers
function getFileSig(filePath) {
    var sig = fileSignature.identify(filePath)
    if (sig != null) {
        return sig
    } else {
        return false
    }
}



function checkFileBanned(filePath, fileMeta) {
    if (fileMeta == "PASS-THROUGH") {
        return false
    }
    if (fileMeta != null) {
        const ext = fileMeta["extension"]
        bannedExtensions = ["exe", "html", "php", "hta", "htm", "scr"]
        for (var i in bannedExtensions) {
            if (bannedExtensions[i] == ext) {
                return true
            }
        }
        return false
    } else {
        return false
    }
}

function checkLevel(email) {
    limitData = conn.query("SELECT * FROM accounts WHERE email=" + con.escape(email))
    if (limitData != null || limitData != "") {
        return limitData[0]["level"]
    }
}

function checkUploadLimit(user) {
    if (user != "anonymous") {
        var level = String(checkLevel(user))
        if (level == "0") {
            return 200
        } else if (level == "0.1") {
            return 400
        } else if (level == "1") {
            return 1000
        }
    } else {
        return 100
    }
}

function moveFile(file, somePlace) {
    return new Promise((resolve, reject)=>{
        file.mv(somePlace, function(err) {
            if (err) return reject(err);

            resolve();
            });
        });
  }

// Routes URLs
function router(app) {
    // Standalone message - mainly just for testing
    app.get("/", function(req, res) {
        res.sendStatus(401)
    })

    // [GET] Upload limit - for current user (Basic Auth) 
    app.get("/v2/check_limit", function(req, res) {
        var user = req.auth["user"]
        res.send(checkUploadLimit(user) + "MiB")
    })

    // [POST] Upload route
    app.post("/v2/upload", function (req, res) {
	console.log("Upload request received")
        if (req.files.upload.data == null) {
            res.status(500).send({
                status: "Fail",
                code: 500,
                message: {
                    body: "Sorry! Something unexpected occurred. Please contact kyouko.se giving them detailed steps of how you got this error.",
                    errStage: 1
                }
            })
        }
        const byteAmt = req.files.upload.data.length
        const mbAmt = byteAmt / 1048576
        const uploadLimit = checkUploadLimit(req.auth["user"])
        if (mbAmt > uploadLimit) {
            res.status(418).send({
                status: "Fail",
                code: 418,
                message: {
                    body: "This file exceeds your upload limit",
                    uploadLimit: uploadLimit
                }
            })
            return
        }

        isRandom = false
        var randomPath = crypto.randomBytes(6).toString("hex") + path.extname(req.files.upload["name"])
        // Generate random file name
        while (isRandom) {
            checkUnique = "SELECT * FROM files WHERE filename=" + con.escape(randomPath)
            nameData = conn.query(checkUnique)
            if (nameData[0] == null) {
                isRandom = true
            } else {
                randomPath = crypto.randomBytes(6).toString("hex") + path.extname(req.files.upload["name"])
            }
        }

        //req.files.upload.mv("/media/DISK2/www/pomfe.co/html/files/" + randomPath, function (err) {
        const mFP  = req.files ? moveFile(req.files.upload, "/home/files/" + randomPath) : Promise.resolve('No file present');

        mFP.then(() => {
                const filePath = "/home/files/" + randomPath

                // Get file metadata
                var fileMeta = getFileSig(filePath)
                if (fileMeta == false) {
                    fileMeta = "PASS-THROUGH"
                }
/*                if (fileMeta == false) {
                    fs.unlinkSync(filePath)
                    res.status(415).send({
                        status: "Fail",
                        code: 415,
                        message: {
                            body: "Sorry we don't support this media type<br>If you were uploading a text file try using <a href='https://p.kyouko.se'>Kyouko Paste</a> instead"
                        }
                    })
                    return
                } */
                
                if (!checkFileBanned(filePath, fileMeta)) {
                    q = "INSERT INTO files (hash, originalname, filename, size, delid, user) VALUES (" + con.escape(md5.sync(filePath)) + ", " + con.escape(req.files.upload["name"]) + ", " + con.escape(randomPath) + ", " + byteAmt + ", 'NA', " + con.escape(req.auth["user"]) + ")"
                    con.query(q, function(err, result, fields) {
                        if (!err) {
                            //fs.unlinkSync(filePath)
                            res.status(200).send({
                                status: "Success",
                                code: 200,
                                message: {
                                    body: "Your file was successfully uploaded",
                                    originalName: req.files.upload["name"],
                                    newName: randomPath,
                                    link: "https://a.kyouko.se/" + randomPath 
                                }
                            })
                        } else {
                            console.log(err)
                            res.status(500).send({
                                status: "Fail",
                                code: 500,
                                message: {
                                    body: "Sorry! Something unexpected occurred. Please contact kyouko.se giving them detailed steps of how you got this error.",
                                    errStage: 3
                                }
                            })       
                        }
                    })
                    return
                   /* var mime
                    if (fileMeta != null) {
                        mime = fileMeta["mimeType"]
                    } else if (path.extname(filePath) == "wav") {
                        mime = "audio/wav"
                    } else if (path.extname(filePath) == "avi") {
                        mime = "video/avi"
                    }

                    // Upload to Wasabi through the S3 API using aws-sdk
                    var params = {Bucket: 'kyouko', Key: randomPath, Body: req.files.upload["data"]};
                    s3.putObject(params).
                    on('build', function(req) { req.httpRequest.headers['Content-Type'] = mime }).
                    send(function(err, data) {  
                        if (err) {
                            console.log(err)
                            res.status(500).send({
                                status: "Fail",
                                code: 500,
                                message: {
                                    body: "Sorry! Something unexpected occurred. Please contact kyouko.se giving them detailed steps of how you got this error.",
                                    errStage: 2
                                }
                            })
                        } else {
                            q = "INSERT INTO files (hash, originalname, filename, size, delid, user) VALUES (" + con.escape(md5.sync(filePath)) + ", " + con.escape(req.files.upload["name"]) + ", " + con.escape(randomPath) + ", " + byteAmt + ", 'NA', " + con.escape(req.auth["user"]) + ")"
                            con.query(q, function(err, result, fields) {
                                if (!err) {
                                    //fs.unlinkSync(filePath)
                                    res.status(200).send({
                                        status: "Success",
                                        code: 200,
                                        message: {
                                            body: "Your file was successfully uploaded",
                                            originalName: req.files.upload["name"],
                                            newName: randomPath,
                                            link: "https://kyouko.s3.wasabisys.com/" + randomPath 
                                        }
                                    })
                                } else {
                                    console.log(err)
                                    res.status(500).send({
                                        status: "Fail",
                                        code: 500,
                                        message: {
                                            body: "Sorry! Something unexpected occurred. Please contact kyouko.se giving them detailed steps of how you got this error.",
                                            errStage: 3
                                        }
                                    })       
                                }
                            }) 
                        }
                    }) */
                } else {
                    fs.unlinkSync(filePath)
                    res.status(415).send({
                        status: "Fail",
                        code: 415,
                        message: {
                            body: "Sorry we don't support this media type<br>If you were uploading a text file try using <a href='https://p.kyouko.se'>Kyouko Paste</a> instead"
                        }
                    })
                    return
                }
        }).catch((errr) => {
            console.log(errr)
            res.status(500).send({
                status: "Fail",
                code: 500,
                message: {
                    body: "Sorry! Something unexpected occurred. Please contact kyouko.se giving them detailed steps of how you got this error.",
                    errStage: 1
                }
            })
            return
        });
    })
}

module.exports = {
    router
}
