const urlModel = require('../models/urlModel')
const mongoose = require('mongoose')
const shortid = require('shortid')
//const redisClient =require('../redis/redis')

// //----------------------caching-----------------------//
const redis1 = require("redis")
const { promisify } = require("util");

//Connect to redis
const redis = redis1.createClient(
    13684,
    "redis-13684.c263.us-east-1-2.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redis.auth("5KeEQ7vd1SfOEDNhwplgr39Jc1faH6V5", function (err) {
    if (err) throw err;
});

redis.on("connect", async function () {
    console.log("Connected to Redis..");
});

//Connection setup for redis

const SET_ASYNC = promisify(redis.SET).bind(redis);
const GET_ASYNC = promisify(redis.GET).bind(redis);



//-------------------functions------------------------//
const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false

    return true;
}


function validhttpsLower(value) {
    if (/^https?:\/\//.test(value)) return true;
    return false
}

function validhttpsUpper(value) {
    if (/^HTTPS?:\/\//.test(value)) return true
    return false
}



function validateUrl(value) {
    return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(
        value
    );
}

//-------------------------------------------------------//

const urlShortner = async function (req, res) {
    try {
        const baseUrl = 'http://localhost:3000'
        let { longUrl } = req.body


        if (!isValid(longUrl)) {
            res.status(400).send({ status: false, message: "longUrl is required " })
            return
        }

        let checkUrl = longUrl.trim()
        //const Url2 = Url1.split("").map(x => x.trim()).join("");


        if (validhttpsLower(checkUrl)) {
            const regex = /^https?:\/\//
            checkUrl = checkUrl.replace(regex, "http://")

        }

        if (validhttpsUpper(checkUrl)) {
            const regex = /^HTTPS?:\/\//
            checkUrl = checkUrl.replace(regex, "http://")

        }

        if (!validateUrl(checkUrl)) {
            return res.status(400).send({ status: false, message: "longUrl is not valid " })
        }
        //-------------------------------Validation Ends--------------------------------------------//


        let shortUrl = await GET_ASYNC(`${checkUrl}`)
        if (shortUrl) {
            let cacheData = JSON.parse(shortUrl)
            let cacheData1 = { longUrl: cacheData.longUrl, shortUrl: cacheData.shortUrl, urlCode: cacheData.urlCode }
            return res.status(200).send({ satus: true, msg: "ShortUrl already generated in cache", data: cacheData1 })
        }

        let findUrlInDb = await urlModel.findOne({ longUrl: checkUrl }).select({ _id: 0, createdAt: 0, updatedAt: 0, __v: 0 })
        if (findUrlInDb) {
            await SET_ASYNC(`${checkUrl}`, JSON.stringify(findUrlInDb))
            return res.status(200).send({ status: true, message: "ShortUrl already generated in DB", data: findUrlInDb })
        }

        const urlCode = shortid.generate().toLowerCase()


        shortUrl = baseUrl + '/' + urlCode
        url = {
            urlCode: urlCode,
            longUrl: checkUrl,
            shortUrl: shortUrl
        }
        await urlModel.create(url)
        const newUrl1 = await urlModel.findOne({ urlCode })
        const newUrl = await urlModel.findOne({ urlCode }).select({ _id: 0, createdAt: 0, updatedAt: 0, __v: 0 })
        await SET_ASYNC(`${checkUrl}`, JSON.stringify(newUrl1))
        await SET_ASYNC(`${urlCode}`, JSON.stringify(newUrl1))
        res.status(201).send({ status: true, data: newUrl })

    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

//------------------------------------------------------------------------------------------------///

const urlCode = async function (req, res) {
    try {
        const urlCode = req.params.urlCode
        //const urlCode1 = urlCode.split("").map(x => x.trim()).join("");

        if (urlCode.length === 0) {          //!check with mentor//
            res.status(400).send({ status: false, message: "No UrlCode found " })
            return
        }

        let findUrlInCache = await GET_ASYNC(`${urlCode}`)
        //let x = JSON.parse(findUrlInCache)
        //console.log(x)
        if (findUrlInCache) {
            let cacheData = JSON.parse(findUrlInCache)
            //return res.status(302).send({data: cacheData.longUrl, msg : "from cashe"})
            return res.status(302).redirect(cacheData.longUrl)
        } else {
            const url = await urlModel.findOne({ urlCode: urlCode })
            //console.log(url)
            if (!url) {
                return res.status(404).send({ status: false, message: "No Url Found" })
            } else {
                let oldUrl = url.longUrl

                await SET_ASYNC(`${url.urlCode}`, JSON.stringify(url))
                return res.status(302).redirect(oldUrl)

            }
        }
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}



module.exports = { urlShortner, urlCode }