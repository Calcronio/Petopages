/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind } = require("../middleware/database_query");



router.get("/valid_license", auth, async(req, res)=>{
    try {
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);

        res.render("valid_license", {
            general:general[0]
        });
    } catch (error) {
        console.log(error);
    }
});


router.get("/index", auth, async(req, res)=>{
    try {
        let date = new Date().toISOString().split("T");

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);
        
        if (req.user.admin_role == "1" || req.user.admin_role == "4") {

            const category = await DataFind(`SELECT COUNT(*) AS total FROM tbl_category`);
    
            const services = await DataFind(`SELECT COUNT(*) AS total FROM tbl_services`);
    
            const statuss = await DataFind(`SELECT COUNT(*) AS total FROM tbl_status_list`);
    
            const zone = await DataFind(`SELECT COUNT(*) AS total FROM tbl_zone`);
    
            const ostatus = await DataFind(`SELECT
                                                COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS pending,
                                                COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS processing,
                                                COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS cancel,
                                                COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS start,
                                                COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS end,
                                                COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS complete,
                                                COALESCE(SUM(CASE WHEN date = '${date[0]}' THEN 1 ELSE 0 END), 0) AS today
                                            FROM tbl_order;`);
    
            const customer = await DataFind(`SELECT
                                                COALESCE(COUNT(*), 0) AS total,
                                                COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS active,
                                                COALESCE(SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END), 0) AS deactive
                                            FROM tbl_customer;`);
    
            const sitter = await DataFind(`SELECT
                                                COALESCE(COUNT(*), 0) AS total,
                                                COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS active,
                                                COALESCE(SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END), 0) AS deactive,
                                                COALESCE(SUM(CASE WHEN verified_status = '1' THEN 1 ELSE 0 END), 0) AS verified,
                                                COALESCE(SUM(CASE WHEN verified_status = '0' THEN 1 ELSE 0 END), 0) AS unverified
                                            FROM tbl_sitter;`);

            let service_rating = await DataFind(`SELECT COALESCE(SUM(rev.star_no) / COUNT(*), 0) as avg_star FROM tbl_sitter_reviews as rev`);

            res.render("index_admin", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category, services, statuss, zone, Status, ostatus, service_rating, customer, sitter
            });

        } else {

            let sid = req.user.admin_id;

            const sitter = await DataFind(`SELECT sitt.logo, sitt.title, sitt.wallet, sitt.verified_status
                                        FROM tbl_admin AS ad
                                        JOIN tbl_sitter AS sitt ON ad.country_code = sitt.country_code AND ad.phone = sitt.phone
                                        where ad.id = '${sid}'`);

            const gallery_data = await DataFind(`SELECT COUNT(*) AS tot_image FROM tbl_sitter_gallery where sitter_id = '${sid}'`);

            const service = await DataFind(`SELECT COUNT(*) AS tot_service FROM tbl_sitter_services where sitter_id = '${sid}'`);

            const pet_detail = await DataFind(`SELECT COUNT(*) AS tot_pet FROM tbl_pet_detail where customer = '${sid}'`);

            const coupon_list = await DataFind(`SELECT COUNT(*) AS tot_coupon FROM tbl_coupon WHERE sitter_id = '${sid}'`);
            
            const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
            let tot_about = 0;
            if (about_data != "") {
                const aboutheading = about_data[0].heading.split("&!");
                tot_about = aboutheading.length;
            }

            const review_list = await DataFind(`SELECT COUNT(*) AS tot_review FROM tbl_sitter_reviews WHERE sitter_id = '${sid}'`);

            const faq_data = await DataFind(`SELECT COUNT(*) AS tot_faq FROM tbl_sitter_faq WHERE sitter_id = '${sid}'`);

            const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${sid}'`);
            let select_time = 0;
            if (setting != "") {
                select_time = setting[0].sitter_time == null ? '0' : setting[0].sitter_time.split(",");
                select_time = select_time == "" ? 0 : select_time.length;
            }

            const tot_balance = await DataFind(`SELECT COALESCE(SUM(amount), '0') as tot_amount FROM tbl_wallet_withdraw WHERE sitter_id = '${sid}'`);

            const ostatus = await DataFind(`SELECT
                                                COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS pending,
                                                COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS processing,
                                                COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS cancel,
                                                COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS start,
                                                COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS end,
                                                COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS complete,
                                                COALESCE(SUM(CASE WHEN date = '${date[0]}' THEN 1 ELSE 0 END), 0) AS today
                                            FROM tbl_order WHERE sitter_id = ${sid}`);

            let service_rating = await DataFind(`SELECT COALESCE(SUM(star_no) / COUNT(*), 0) as avg_star FROM tbl_sitter_reviews WHERE sitter_id = ${sid} GROUP BY sitter_id`);

            let star = 0;
            if (service_rating != "") {
                let number = service_rating[0].avg_star;
                if (number != "0") {
                    if (number % 1 >= 0.25 && number % 1 < 0.75) {
                        star = Math.round(number * 2) / 2;
                    } else {
                        star = Math.round(number);
                    }
                    service_rating[0].avg_star = star;
                }
            }
            if (service_rating == "") service_rating = [{avg_star:0}];

            const pstatus = await DataFind(`SELECT
                                                COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS pending,
                                                COALESCE(SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END), 0) AS complete
                                            FROM tbl_wallet_withdraw WHERE sitter_id = ${sid}`);

            let dashboad = [
                { field_name: req.lan.ld.Services, tot_no: service[0].tot_service },
                { field_name: req.lan.ld.Pet, tot_no: pet_detail[0].tot_pet },
                { field_name: req.lan.ld.Coupon, tot_no: coupon_list[0].tot_coupon },
                { field_name: req.lan.ld.Gallery, tot_no: gallery_data[0].tot_image},
            ];

            let dashboad1 = [
                { field_name: req.lan.ld.About, tot_no: tot_about },
                { field_name: req.lan.ld.Reviews, tot_no: review_list[0].tot_review },
                { field_name: req.lan.ld.FAQ, tot_no: faq_data[0].tot_faq },
                { field_name: req.lan.ld.Timeslot, tot_no: select_time },
            ];

            let dashboad2 = [
                { field_name: req.lan.ld.Today_Book_Services, tot_no: ostatus[0].today },
                { field_name: Status[0].name, tot_no: ostatus[0].pending },
                { field_name: Status[1].name, tot_no: ostatus[0].processing },
                { field_name: Status[2].name, tot_no: ostatus[0].cancel },
            ];
            
            let dashboad3 = [
                { field_name: Status[3].name, tot_no: ostatus[0].start },
                { field_name: Status[4].name, tot_no: ostatus[0].end },
                { field_name: Status[5].name, tot_no: ostatus[0].complete },
                { field_name: req.lan.ld.Comlete_Service_Rating, tot_no: service_rating[0].avg_star + "/5" },
            ];

            let dashboad4 = [
                { field_name: req.lan.ld.My_Earning, tot_no: sitter[0].wallet },
                { field_name: req.lan.ld.Payout, tot_no: tot_balance[0].tot_amount },
                { field_name: req.lan.ld.Complete + ' ' + req.lan.ld.Payout, tot_no: pstatus[0].pending },
                { field_name: req.lan.ld.Pending + ' ' + req.lan.ld.Payout, tot_no: pstatus[0].complete }
            ];

            let sname = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${req.user.admin_id}'`);
            
            res.render("index_sitter", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, dashboad, dashboad1, dashboad2, dashboad3, dashboad4, 
                sname
            });
        }
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;