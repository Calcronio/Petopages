const socket = io();

const uid = document.getElementById('chat_u_id').value;

function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

$(document).on('input', '#chat_input', function(){
    const userId = document.getElementById('senderu_id').value;
    socket.emit('chat typing', { userId, uid });
});


// Chat Start Bottom
function scrollBottom() {
    let chatDetail = document.getElementById('scrollbottom');
    chatDetail.scrollTop = chatDetail.scrollHeight;
}

function today_date(date) {
    let data = '<li class="text-center my-2">'+
                    '<span class="f-w-500">'+ date +'</span>'+
                '</li>';

    return data;
}

function rightMessage(ndate, message) {
    let data = '<li class="clearfix">'+
                    '<div class="message other-message pull-right py-1 mb-1 bg-light-primary" style="width: fit-content; max-width: 50%;">'+
                        '<div class="message-data m-0"><span class="message-data-time">'+ndate+'</span></div>'+message+''+
                    '</div>'+
                '</li>';
    return data;
}

function leftMessage(date, message) {
    let data = '<li>'+
                    '<div class="message my-message py-1 mb-1" style="width: fit-content; max-width: 50%;">'+
                        '<div class="message-data text-end m-0"><span class="message-data-time">'+date+'</span></div>'+message+''+
                    '</div>'+
                '</li>';
    return data;
}

function allUserList(id, name, message, date, status, background) {
    let newmessage = "";
    if (status != 1) newmessage = 'd-none';

    let firstc = name.charAt(0);

    let data = '<div class="d-flex align-items-center rounded-3 my-1 py-3 px-2 '+ background +' chat_div" id="chat_user" data-id="'+id+'">'+
                    '<div class="m-r-10 px-3 py-2 d-flex align-items-center rounded-circle bg-primary">'+
                        '<p class="m-0 f-18 f-w-700 ">'+ firstc +'</p>'+
                    '</div>'+
                    '<div>'+
                        '<h5 class="name mb-1 d-flex">'+
                            ''+name+''+
                            '<span class="dot1 '+ newmessage +'" id="new_message" style="margin-left: 5px;"></span>'+
                            '<span class="loadingDots d-none" id="user_list_typing"><span class="dot1 m-0"></span><span class="dot2 m-0"></span><span class="dot3 m-0"></span><span class="dot4 m-0"></span></span> '+
                        '</h5>'+
                        '<p class="status f-w-700 m-0">'+message+' <span class="f-w-400">'+date+'</span></p>'+
                    '</div>'+
                '</div>';
    return data;
}



document.getElementById('chat_send_btn').addEventListener('click', async () => {
    
    const userId = document.getElementById('senderu_id').value;

    const message = document.getElementById('chat_input').value;
    
    if (message.trim() != '' && userId != "0" &&  userId != "") {
    
        let ndate = formatAMPM(new Date);
        const base_url = window.location.origin;
        $.ajax({
            url: base_url + '/chat/chat_save',
            type: 'POST',
            dataType: 'JSON',
            data: {uid:uid, userId:userId, message:message},
            success: function (res){

                // User Send Message Update
                if (res.today_date != "0") {
                    today_date(res.today_date);
                    $("#chat_detail").append( today_date(res.today_date) );
                    
                    $("#chat_detail").append( rightMessage(ndate, message) );
                    
                } else {
                    $("#chat_detail").append( rightMessage(ndate, message) );
                }

                scrollBottom();

                // User List Update
                $("#chat_user_list").html("");
                res.chat_list.forEach(function(data){

                    if (data.sender_id == userId || data.resiver_id == userId) {

                        $("#chat_user_list").append( allUserList(data.id, data.u_name, data.message, data.date, "0", 'chat_background') );
                    } else {

                        $("#chat_user_list").append( allUserList(data.id, data.u_name, data.message, data.date, "0", '') );
                    } 
                });

                $("#chat_profile_time").html("").html('Last Message ' + ndate);

                // New Message Check
                socket.emit('chat check', { userId: userId, uid: uid, check: 0 });
                
                // Chat Send
                socket.emit('chat message', { userId, uid, date:ndate, today: res.today_date, message: message });
            }
        });

        document.getElementById('chat_input').value = "";
    }
});



function addMessage(list, message, check) {
    const userId = document.getElementById('senderu_id').value;

    // User Received Message Update 
    if (userId == message.uid && check == "2") {

        if (message.today != "0") {
            $("#chat_detail").append( today_date(message.today) );

            $("#chat_detail").append( leftMessage(message.date, message.message) );
        } else {
            $("#chat_detail").append( leftMessage(message.date, message.message) );
        }
    } else if (uid == message.uid && check == "1") {

        if (message.today != "0") {
            $("#chat_detail").append( today_date(message.today) );

            $("#chat_detail").append( rightMessage(message.date, message.message) );
        } else {
            $("#chat_detail").append( rightMessage(message.date, message.message) );
        }
    }

    scrollBottom();

    // User List Update 
    $("#chat_user_list").html("");
    list.forEach(function(data, i){

        let nm = "", nd = "";
        if (data.sender_id == message.uid && data.resiver_id == message.userId && data.sender_id == message.uid && data.resiver_id == message.userId) {
            nm = message.message;
            nd = "1s";
        } else {
            nm = data.message;
            nd = data.date;
        }
        
        if (data.sender_id == userId || data.resiver_id == userId) {

            $("#chat_user_list").append( allUserList(data.id, data.u_name, nm, nd, data.status, 'chat_background') );
        } else {

            let status = 0;

            if (uid == message.userId && uid != message.uid) {
                if (data.sender_id == message.uid && data.resiver_id == message.userId) {
                    status = 1;
                } 
                if (data.sender_id == message.userId && data.resiver_id == message.uid) {
                    status = 1;
                }  
            } else {
                status = data.status;
            }

            $("#chat_user_list").append( allUserList(data.id, data.u_name, nm, nd, status, '') );
        }
    });

    let lastM = list[list.length - 1].date;
    $("#chat_profile_time").html("").html('Last Message ' + lastM);

}


// // Receive and display chat messages
socket.on('chat message', (message) => {
    let check = 0;
    if (uid == message.uid && uid != message.userId) {
        check = 1;
    } else if(uid != message.uid && uid == message.userId) {
        check = 2;
    }
    
    if (check != "0") {
        const userId = document.getElementById('senderu_id').value;
        
        let already_read = 0;
        if (uid == message.userId && userId == message.uid) {
            already_read = 1;
        }
        const base_url = window.location.origin;
        
        $.ajax({
            url: base_url + '/chat/real_time',
            type: 'POST',
            dataType: 'JSON',
            data: {uid:uid, cuid:message.uid, userId:message.userId, today:message.today, already_read},
            success: function (res){
                
                message.today = res.today_date;
                addMessage(res.list, message, check);
            }
        });
    }
});



// // Receive and display chat messages
let check = 0;
socket.on('chat typing', (message) => {
    
    const userId = document.getElementById('senderu_id').value;
    if (userId == message.uid && uid == message.userId) {
        $("#user_typing").removeClass('d-none');
    }
    
    $(".chat_div").each(function(){
        let check_id = 0;
        if ($(this).attr('data-sender') == uid) {
            check_id = $(this).attr('data-reciver');
        } else {
            check_id = $(this).attr('data-sender');
        }
        
        if (uid == message.userId && check_id == message.uid) {
            $(this).find("#user_list_typing").removeClass('d-none');
        }
    });
    
    scrollBottom();
    
    if (check == "0") {
        check = 1;
        setTimeout(() => {
            
            removetyping();

        }, 2000);
    }

});

function removetyping() {
    check = 0;
    $(".chat_div").each(function(){
        $(this).find("#user_list_typing").addClass('d-none');
    });

    $("#user_typing").addClass('d-none');
}