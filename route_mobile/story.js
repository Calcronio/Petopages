/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const schedule = require('node-schedule');
const fs = require('fs-extra');
const { DataFind, DataInsert, DataDelete } = require("../middleware/database_query");

function getfulltime() {
    let date = new Date();
    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth()+1).padStart(2, '0');
    let year = date.getFullYear();
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let secound = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${secound}`;
}

async function recreateJobs() {
    try {
        const scheduledJobs = await DataFind('SELECT * FROM tbl_story');
        scheduledJobs.forEach(job => {
            let ndate = new Date(new Date(job.time).getTime() + 24 * 60 * 60 * 1000);
            schedule.scheduleJob(ndate, async function() {
                
                const folder_path = "public/" + job.image;

                fs.unlink(folder_path, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                        return;
                    }
                    console.log('Story deleted successfully.');
                });
                if (await DataDelete(`tbl_story`, `image = '${job.image}'`, job.hostname, job.protocol) == -1) return;
            });
        });
    } catch (error) {
        console.error(error);
    }
}
recreateJobs();

function deletestory(ipath, hostname, protocol){
    schedule.scheduleJob(new Date(Date.now() + 24 * 60 * 60 * 1000), async function() {

        const folder_path = "public/" + ipath;
        fs.unlink(folder_path, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('Story deleted successfully.');
        }); 

        if (await DataDelete(`tbl_story`, `image = '${ipath}'`, hostname, protocol) == -1) return;
    });
}

async function addStory(uid, sitter_id, imageUrl, hostname, protocol) {
    let date = getfulltime();

    if (uid != "") {
        if (await DataInsert(`tbl_story`, `c_id, time, image, hostname, protocol`, `'${uid}', '${date}', '${imageUrl}', '${hostname}', '${protocol}'`, hostname, protocol) == -1) {
            return -1;
        }
    } else if(sitter_id != "") {

        if (await DataInsert(`tbl_story`, `c_id, time, image, hostname, protocol`, `'${sitter_id}', '${date}', '${imageUrl}', '${hostname}', '${protocol}'`, hostname, protocol) == -1) {
            return -1;
        }
    }
    deletestory(imageUrl, hostname, protocol);
    return true;
}



function storytime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = 0;
    if (hours == "0" && minutes == "0") {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        dtime = `${seconds}s`;
    } else if (hours == "0" && minutes != "0") {
        dtime = `${minutes}m`;
    } else {
        dtime = `${hours}h`;
    }
    return dtime;
}

async function storyData(uid, lat, lon) {
    // // // Zone User Story Show  
    // const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
    // const current_loca = { latitude: Number(lat), longitude: Number(lon) };
    
    // let all_zone = [];
    // for (let i = 0; i < zone_data.length;){
    //     let aplz = zone_data[i].lat_lon.split(',');
    //     let all_lat = [];
    //     aplz.map(val => {
    //         let [latitude, longitude] = val.split(':').map(Number);
    //         all_lat.push({ latitude, longitude });
    //     })
    //     let count = geolib.isPointInPolygon(current_loca, all_lat);
    //     if (count === true) {
    //         all_zone.push(zone_data[i].id);
    //     }
    //     i++;
    // }

    // let where = "";
    // if (all_zone != "") where = `WHERE si.zone IN ('${all_zone}')`;

    // const sitter_data = await DataFind(`SELECT si.logo, si.name,
    //                                     ad.id as a_id, 
    //                                     st.id as stid, st.time, st.image
    //                                     FROM tbl_sitter as si
    //                                     JOIN tbl_admin AS ad ON ad.country_code = si.country_code AND ad.phone = si.phone
    //                                     JOIN tbl_story AS st ON ad.id = st.c_id
    //                                     ${where} ORDER BY si.id DESC`);

    // const all_story = await DataFind(`SELECT "" as logo, adm.name as name, adm.id as a_id, sto.id as stid, sto.time, sto.image
    //                                     FROM tbl_story as sto
    //                                     JOIN tbl_admin as adm ON sto.c_id = adm.id
    //                                     where sto.c_id = '${uid}' ORDER BY sto.id DESC`);

    // console.log(sitter_data);
    // console.log(all_story);

    // let mix_story;
    // if (all_story != "") {
    //     mix_story = all_story.concat(sitter_data);
    // } else {
    //     mix_story = sitter_data;
    // }



    // // // All User Story Show 
    const mix_story = await DataFind(`SELECT COALESCE(si.logo, '') as logo, adm.name as name, adm.id as a_id, sto.id as stid, sto.time, sto.image
                                        FROM tbl_story as sto
                                        LEFT JOIN tbl_admin as adm ON sto.c_id = adm.id
                                        LEFT JOIN tbl_sitter as si ON adm.country_code = si.country_code AND adm.phone = si.phone
                                        ORDER BY sto.id DESC`);


                                        
    const high_sort = mix_story.sort((a, b) => b.stid - a.stid);

    let cid = [];
    high_sort.map(asid => {
        let acheckid = (asid.a_id).toString();
        if (cid.includes(acheckid) === false) {
            cid.push(acheckid);
        }
    });

    let allc_story = [];
    for (let a = 0; a < cid.length;){
        let allc_data = [];

        for (let a = 0; a < high_sort.length;) {
            if (high_sort[a].a_id == cid[a]) {
                if (allc_data.length === 0) {
                    allc_story.push({ id: high_sort[a].a_id, name: high_sort[a].name, logo: high_sort[a].logo, story: [] });
                }
                let dtimer = storytime(high_sort[a].time);
                allc_data.push({ image: high_sort[a].image, time: dtimer });
            }
            a++;
        }

        if (allc_data.length > 0) {
            allc_story[allc_story.length - 1].story = allc_data;
        }
        a++;
    }
    return allc_story;
}



module.exports = {addStory, storyData};