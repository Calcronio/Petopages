const jwt = require('jsonwebtoken');
const {mySqlQury} = require('../middleware/db')
const langlist = require("../public/language/language.json")

const auth = async(req, res, next) => {
    try {
        const token = req.cookies.pet;

        if (!token) {
            req.flash("errors", 'Unauthorized acces detected. please log in to proceed.')
            return res.redirect("/")
        }

        const decode = await jwt.verify(token, process.env.jwt_key)
        if (decode.admin_role == "4") {
            const admin = await mySqlQury(`SELECT country_code, phone FROM tbl_admin WHERE id = "${decode.admin_id}"`)
            const role_data = await mySqlQury(`SELECT * FROM tbl_role_permission WHERE country_code = '${admin[0].country_code}' AND phone = '${admin[0].phone}'`)
            let index = 0
            let role = Object.keys(role_data[0]).reduce((key, i) => {
                let rval = role_data[0][i];
                if (index > 5) rval = rval.split(",")
                    key[i] = rval
                index++
                return key
            }, {})
            req.per = role
            decode.admin_role = "1"
        } else {
            req.per = "1"
        }
        req.user = decode

        const general_setting = await mySqlQury(`SELECT * FROM tbl_general_settings`)
        req.general = general_setting[0]

        let notification = ""
        if (decode.admin_role == "1") {
            notification = await mySqlQury(`SELECT COALESCE(ord.order_id, "") as order_id, noti.date,
                                            COALESCE(sta.name, "") as sname, COALESCE(sta.notifi_text, "") as notification
                                            FROM tbl_notification as noti
                                            LEFT JOIN tbl_status_list as sta ON noti.status = sta.id
                                            LEFT JOIN tbl_order as ord ON noti.order_id = ord.id
                                            ORDER BY noti.id DESC LIMIT 5`)

        } else {
            notification = await mySqlQury(`SELECT COALESCE(ord.order_id, "") as order_id, noti.date,
                                            COALESCE(sta.name, "") as sname, COALESCE(sta.notifi_text, "") as notification
                                            FROM tbl_notification as noti
                                            LEFT JOIN tbl_status_list as sta ON noti.status = sta.id
                                            LEFT JOIN tbl_order as ord ON noti.order_id = ord.id
                                            WHERE s_id = '${decode.admin_id}' ORDER BY noti.id DESC LIMIT 5`)
        }
        req.notification = notification



        const lan = req.cookies.lan;
        if (!lan) {
            req.lan = {ld: langlist.en, lname:language.lang}
        } else {
            let language = await jwt.verify(lan, process.env.jwt_key);

            if (language.lang == "en") {
                req.lan = {ld: langlist.en, lname:language.lang}
            } else if(language.lang == "in") {
                req.lan = {ld: langlist.in, lname:language.lang}
            } else if(language.lang == "de") {
                req.lan = {ld: langlist.de, lname:language.lang}
            } else if(language.lang == "pt") {
                req.lan = {ld: langlist.pt, lname:language.lang}
            } else if(language.lang == "es") {
                req.lan = {ld: langlist.es, lname:language.lang}
            } else if(language.lang == "fr") {
                req.lan = {ld: langlist.fr, lname:language.lang}
            } else if(language.lang == "cn") {
                req.lan = {ld: langlist.cn, lname:language.lang}
            } else if(language.lang == "ae") {
                req.lan = {ld: langlist.ae, lname:language.lang}
            }
        }





        next()
    } catch (error) {
        console.log(error);
    }
}

module.exports = auth;