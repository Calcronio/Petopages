/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const XLSX = require('xlsx');
const path = require("path");
const fs = require('fs-extra');
const schedule = require('node-schedule');
const { DataFind } = require("../middleware/database_query");



function downloadFile(xlsxdata, name, filename, res) {

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.aoa_to_sheet(xlsxdata);

    XLSX.utils.book_append_sheet(workbook, worksheet, name);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    let fname = `${filename}-${Date.now()}.xlsx`;

    const folderPath = path.resolve(__dirname, '../public/uploads/report/' + fname);

    fs.writeFile(folderPath, buffer, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        } else {
            console.log("File written successfully.");
            
            if (fs.existsSync(folderPath)) {

                res.sendFile(folderPath, (err) => {
                    if (err) {
                        console.error("Error sending file:", err);
                        res.status(500).send("Error sending file");
                    } else {
                        console.log("File sent successfully.");
                        deletefile(fname);
                    }
                });
            } else {
                console.error("File does not exist:", folderPath);
            }
        }
    });
}

function deletefile(fname) {
    schedule.scheduleJob(new Date(Date.now() + 3000), async function() {
        const folder_path = "public/uploads/report/" + fname;
        fs.unlink(folder_path, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('Report File deleted successfully.');
        }); 
    });
}

async function dailyReport(where) {
    const ostatus = await DataFind(`SELECT
                                        COUNT(*) AS today,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS pending,
                                        COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS processing,
                                        COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS cancel,
                                        COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS start,
                                        COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS end,
                                        COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS complete
                                    FROM tbl_order ${where}`);
    return ostatus;
}

router.get("/daily", auth, async(req, res)=>{
    try {
        const sitter = await DataFind(`SELECT ad.id as id, ad.name as name
                                                FROM tbl_sitter AS si
                                                JOIN tbl_admin AS ad on si.country_code = ad.country_code AND si.phone = ad.phone
                                                ORDER BY id DESC`);

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        let today = new Date().toISOString().split("T")[0];

        let where = "";
        if (req.user.admin_role == "1") where = `WHERE date = "${today}"`;
        if (req.user.admin_role != "1") where = `WHERE date = "${today}" AND sitter_id = "${req.user.admin_role}"`;
        let daily_list = await dailyReport(where);

        res.render("report_daily", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter, Status, daily_list, today
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/daily_data", auth, async(req, res)=>{
    try {
        let {date, sid} = req.body;

        if (req.user.admin_role != "1") sid = req.user.admin_id;

        let where = "", daily_list = "";
        if (date && sid) {
            where = `WHERE date = "${date}" AND sitter_id = "${sid}"`;
            daily_list = await dailyReport(where);

        } else if (date) {
            where = `WHERE sitter_id = "${sid}"`;
            daily_list = await dailyReport(where);

        } else if(sid) {
            where = `WHERE date = "${date}"`;
            daily_list = await dailyReport(where);
        }

        res.send({ daily_list });
    } catch (error) {
        console.log(error);
    }
});




async function sbookservices(where) {
    const order_data = await DataFind(`SELECT ord.id, ord.order_id, ord.date, ord.status, ord.tot_price,
                                        COALESCE(cusa.name, '') as cus_name,
                                        COALESCE(siad.name, '') as sitt_name,
                                        COALESCE(ser.name, '') as service_name,
                                        COALESCE(sta.name, '') as sta_name
                                        FROM tbl_order ord
                                        LEFT join tbl_admin cusa on ord.customer_id = cusa.id
                                        LEFT join tbl_admin siad on ord.sitter_id = siad.id
                                        LEFT join tbl_services ser on ord.service_id = ser.id 
                                        LEFT join tbl_status_list sta on ord.status = sta.id
                                        ${where} ORDER BY ord.id DESC`);
    return order_data;
}

async function sbookQuery(sitter, start, end, status) {
    let services = "", where = "";
    if (sitter && start && end && status) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}" AND ord.date <= "${end}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(sitter && start && end) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}" AND ord.date <= "${end}"`;
        services = await sbookservices(where);

    } else if(sitter && end && status ) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date <= "${end}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(sitter && start && status ) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(start && end && status) {
        where = `WHERE ord.date >= "${start}" AND ord.date <= "${end}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(sitter && start ) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}"`;
        services = await sbookservices(where);

    } else if(sitter && end) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date <= "${end}"`;
        services = await sbookservices(where);

    } else if(sitter && status) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(start && end) {
        where = `WHERE ord.date >= "${start}" AND ord.date <= "${end}"`;
        services = await sbookservices(where);

    } else if(start && status) {
        where = `WHERE ord.date >= "${start}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(end && status) {
        where = `WHERE ord.date <= "${end}" AND ord.status = "${status}"`;
        services = await sbookservices(where);

    } else if(sitter) {
        where = `WHERE ord.sitter_id = "${sitter}" `;
        services = await sbookservices(where);

    } else if(start) {
        where = `WHERE ord.date >= "${start}"`;
        services = await sbookservices(where);

    } else if(end) {
        where = `WHERE ord.date <= "${end}"`;
        services = await sbookservices(where);

    } else if (status) {
        where = `WHERE ord.status = "${status}"`;
        services = await sbookservices(where);
    }
    return services;
}

router.get("/book_service", auth, async(req, res)=>{
    try {
        const sitter = await DataFind(`SELECT ad.id as id, ad.name as name
                                                FROM tbl_sitter AS si
                                                JOIN tbl_admin AS ad on si.country_code = ad.country_code AND si.phone = ad.phone
                                                ORDER BY id DESC`);

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        let where = '';
        if (req.user.admin_role != "1") where = `WHERE ord.sitter_id = "${req.user.admin_id}" `;
        let allservices = await sbookservices(where);

        let torder = allservices != '' ? allservices.length : 0;

        res.render("report_book_service", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter, Status, allservices, torder
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/sbook_service", auth, async(req, res)=>{
    try {
        let {sitter, start, end, status} = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let services = await sbookQuery(sitter, start, end, status);      

        let torder = services != "" ? services.length : 0;

        res.send({ services, torder });
    } catch (error) {
        console.log(error);
    }
});

router.post("/dbook", auth, async (req, res) => {
    try {
        let { sitter, start, end, status } = req.body;

        let where = '';
        if (req.user.admin_role != "1") {
            sitter = (req.user.admin_id).toString();
            where = `WHERE ord.sitter_id = "${req.user.admin_id}" `;
        }

        let services = "";
        if (sitter || start || end || status) {
            services = await sbookQuery(sitter, start, end, status);
        } else {
            services = await sbookservices(where);
        }

        let xlsxdata = [["Service Id", "Date", "Price", "Customer", "Sitter", "Service", "Status"]];
        services.forEach(sdata => {
            let data = [sdata.order_id, sdata.date, sdata.tot_price, sdata.cus_name, sdata.sitt_name, sdata.service_name, sdata.sta_name];
            xlsxdata.push(data);
        });

        if (xlsxdata.length > 0) {
            
            downloadFile(xlsxdata, 'services', 'Bookservices', res);
        }
    } catch (error) {
        console.log(error);
    }
});





async function scommissionservices(where) {
    const order_data = await DataFind(`SELECT ord.id, ord.order_id, ord.site_commisiion as csite, ord.sitter_commission as csitter, ord.tot_price, ord.date,
                                        COALESCE(cusa.name, '') as cus_name,
                                        COALESCE(siad.name, '') as sitt_name
                                        FROM tbl_order ord
                                        LEFT join tbl_admin cusa on ord.customer_id = cusa.id
                                        LEFT join tbl_admin siad on ord.sitter_id = siad.id
                                        ${where} ORDER BY ord.id DESC`);
    return order_data;
}

async function commissionQuery(start, end, sitter) {
    let services = "", where = "";
    if (start && end && sitter) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}" AND ord.date <= "${end}"`;
        services = await scommissionservices(where);
        
    } else if(start && end) {
        where = `WHERE ord.date >= "${start}" AND ord.date <= "${end}"`;
        services = await scommissionservices(where);
        
    } else if(start && sitter) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date >= "${start}" `;
        services = await scommissionservices(where);
        
    } else if(end && sitter) {
        where = `WHERE ord.sitter_id = "${sitter}" AND ord.date <= "${end}"`;
        services = await scommissionservices(where);
        
    } else if(start) {
        where = `WHERE ord.date >= "${start}"`;
        services = await scommissionservices(where);
        
    } else if(end) {
        where = `WHERE ord.date <= "${end}"`;
        services = await scommissionservices(where);
        
    } else if(sitter) {
        where = `WHERE ord.sitter_id = "${sitter}"`;
        services = await scommissionservices(where);

    }
    return services;
}

router.get("/commission", auth, async(req, res)=>{
    try {
        const sitter = await DataFind(`SELECT ad.id as id, ad.name as name
                                                FROM tbl_sitter AS si
                                                JOIN tbl_admin AS ad on si.country_code = ad.country_code AND si.phone = ad.phone
                                                ORDER BY id DESC`);
        
        let where = '';
        if (req.user.admin_role != "1") where = `WHERE ord.sitter_id = "${req.user.admin_id}" `;
        let sdata = await scommissionservices(where);

        let csitter = 0, csite = 0;
        let services = sdata.map(sd => {

            if (req.user.admin_role != "1") sd.tot_price = (parseFloat(sd.tot_price) - parseFloat(sd.csite)).toFixed(2);
            csitter += parseFloat(sd.csitter);
            csite += parseFloat(sd.csite);
            return sd;
        });

        let totservice = services != "" ? services.length : 0;

        res.render("report_commission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter, services, csitter, csite, totservice
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/scommission", auth, async(req, res)=>{
    try {
        let { start, end, sitter } = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let services = await commissionQuery(start, end, sitter);

        let csitter = 0, csite = 0;
        let sdata = services.map(sd => {

            if (req.user.admin_role != "1") sd.tot_price = (parseFloat(sd.tot_price) - parseFloat(sd.csite)).toFixed(2);
            csitter += parseFloat(sd.csitter);
            csite += parseFloat(sd.csite);

            return sd;
        });

        let totservice = services != "" ? services.length : 0;

        res.send({sdata, totservice, csitter, csite});
    } catch (error) {
        console.log(error);
    }
});

router.post("/dcommreport", auth, async(req, res)=>{
    try {
        let { start, end, sitter } = req.body;

        let where = '';
        if (req.user.admin_role != "1") {
            sitter = req.user.admin_id;
            where = `WHERE ord.sitter_id = "${req.user.admin_id}" `;
        }

        let services = "";
        if ( start || end || sitter ) {
            services = await commissionQuery(start, end, sitter);
        } else {
            services = await scommissionservices(where);
        }

        services.map(sd => {
            if (req.user.admin_role != "1") sd.tot_price = (parseFloat(sd.tot_price) - parseFloat(sd.csite)).toFixed(2);
            return sd;
        });

        if (services != "") {
            let xlsxdata = [["Service Id", "Sitter Commission", "Customer Commission", "Price", "Date", "Customer Name", "Sitter Name"]];
            services.forEach(sdata => {
                let data = [sdata.order_id, sdata.csite, sdata.csitter, sdata.tot_price, sdata.date, sdata.cus_name, sdata.sitt_name];
                xlsxdata.push(data);
            });

            if (xlsxdata.length > 0) {

                downloadFile(xlsxdata, 'Commission', 'Commission', res);
            }
        }
        
    } catch (error) {
        console.log(error);
    }
});





async function rtotalpayour(where) {
    const payout = await DataFind(`SELECT wd.date, wd.amount, wd.p_type, wd.status, 
                                            ad.email as aemail
                                            FROM tbl_wallet_withdraw as wd
                                            JOIN tbl_admin as ad ON wd.sitter_id = ad.id
                                            ${where} ORDER BY wd.id DESC`);
    return payout;
}

async function PayoutQuery(sitter, start, end, status) {
    let services = "", where = "";
    if (sitter && start && end && status) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date >= "${start}" AND wd.date <= "${end}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(sitter && start && end) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date >= "${start}" AND wd.date <= "${end}"`;
        services = await rtotalpayour(where);

    } else if(sitter && end && status ) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date <= "${end}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(sitter && start && status ) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date >= "${start}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(start && end && status) {
        where = `WHERE wd.date >= "${start}" AND wd.date <= "${end}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(sitter && start ) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date >= "${start}"`;
        services = await rtotalpayour(where);

    } else if(sitter && end) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.date <= "${end}"`;
        services = await rtotalpayour(where);

    } else if(sitter && status) {
        where = `WHERE wd.sitter_id = "${sitter}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(start && end) {
        where = `WHERE wd.date >= "${start}" AND wd.date <= "${end}"`;
        services = await rtotalpayour(where);

    } else if(start && status) {
        where = `WHERE wd.date >= "${start}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(end && status) {
        where = `WHERE wd.date <= "${end}" AND wd.status = "${status}"`;
        services = await rtotalpayour(where);

    } else if(sitter) {
        where = `WHERE wd.sitter_id = "${sitter}" `;
        services = await rtotalpayour(where);

    } else if(start) {
        where = `WHERE wd.date >= "${start}"`;
        services = await rtotalpayour(where);

    } else if(end) {
        where = `WHERE wd.date <= "${end}"`;
        services = await rtotalpayour(where);

    } else if (status) {
        where = `WHERE wd.status = "${status}"`;
        services = await rtotalpayour(where);
    }
    return services;
}

router.get("/payout", auth, async(req, res)=>{
    try {
        const sitter = await DataFind(`SELECT ad.id as id, ad.name as name
                                        FROM tbl_sitter AS si
                                        JOIN tbl_admin AS ad on si.country_code = ad.country_code AND si.phone = ad.phone
                                        ORDER BY id DESC`);

        let where = "";
        if (req.user.admin_role != "1") where = `WHERE wd.sitter_id = "${req.user.admin_id}" `;
        let pdata = await rtotalpayour(where);

        let tpprice = 0, tcprice = 0;
        let payout = pdata.map(pval => {

            if (pval.status == "0") tpprice += parseFloat(pval.amount);
            if (pval.status == "1") tcprice += parseFloat(pval.amount);
            
            return pval;
        });

        let ptotal = pdata != "" ? pdata.length : 0;
        
        res.render("report_payout", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter, payout, ptotal, tpprice, tcprice
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/payout_data", auth, async(req, res)=>{
    try {
        let {sitter, start, end, status} = req.body;

        let where = '';
        if (req.user.admin_role != "1") {
            sitter = req.user.admin_id;
            where = `WHERE wd.status = "${req.user.admin_id}" `;
        }

        let pdata = "";
        if (sitter || start || end || status) {
            pdata = await PayoutQuery(sitter, start, end, status) ;
        } else {
            pdata = await rtotalpayour(where);
        }

        let tpprice = 0, tcprice = 0;
        let payout = pdata.map(pval => {

            if (pval.status == "0") tpprice += parseFloat(pval.amount);
            if (pval.status == "1") tcprice += parseFloat(pval.amount);
                
            return pval;
        });

        let ptotal = pdata != "" ? pdata.length : 0;

        res.send({ payout, ptotal, tpprice, tcprice });
    } catch (error) {
        console.log(error);
    }
});

router.post("/dpayout", auth, async(req, res)=>{
    try {
        let { sitter, start, end, status } = req.body;

        if (req.user.admin_role != "1") sitter = req.user.admin_id;

        let pdata = "";
        if (sitter || start || end || status) {
            pdata = await PayoutQuery(sitter, start, end, status);
            
        } else {
            let where = "";
            pdata = await rtotalpayour(where);
        }

        let payout = pdata.map(pval => {

            let ptype = "1";
            if (pval.p_type == "1") ptype = "UPI";
            if (pval.p_type == "2") ptype = "Paypal";
            if (pval.p_type == "3") ptype = "Bank Transfer";
            
            let sta = "";
            if (pval.status == "1") sta = "Complete";
            if (pval.status == "0") sta = "Pending";

            pval.p_type = ptype;
            pval.status = sta;
            return pval;
        });

        if (pdata != "") {
            let xlsxdata = [["Date", "Amount", "Email", "Payout Type", "Status"]];
            payout.forEach(pdata => {
                let data = [pdata.date, pdata.amount, pdata.aemail, pdata.p_type, pdata.status];
                xlsxdata.push(data);
            });

            if (xlsxdata.length > 0) {
                downloadFile(xlsxdata, 'Payout', 'Payout', res);
            }
        }
        
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;