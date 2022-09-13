/* 09-09-2022 21.00  v1.30.0-beta.0 */
// changes:
// 1. mute room

var define, CryptoJS;
var crypto = require('crypto');
var md5 = require('./lib/md5');
var tapTalkRooms = {}; //room list with array of messages
var tapTalkRoomListHashmap = {}; //room list last message
var tapTalkRoomListHashmapPinned = {}; //room list last message - pinned
var tapTalkRoomListHashmapUnPinned = {}; //room list last message - unpinned
// var tapTalkEmitMessageQueue = {}; //room list undelivered message
var tapRoomStatusListeners = [];
var tapMessageListeners = [];
var tapListener = [];
var taptalkContact = {};
var tapTalkRandomColors = ['#f99181', '#a914db', '#f26046', '#fb76ab', '#c4c9d1', '#4239be', '#9c89f1', '#f4c22c'];
var projectConfigs = null;
var expiredKey = [];
var refreshAccessTokenCallbackArray = [];
var isConnectRunning = false;
var isDoneFirstSetupRoomList = false;
var isNeedToCallApiUpdateRoomList = true;
var isFirstConnectedToWebSocket = false;
var taptalkStarMessageHashmap = {};
var taptalkUnreadMessageList = {};
var taptalkPinnedMessageHashmap = {};
var taptalkPinnedMessageIDHashmap = {};

var db;
// window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

//initiate index db for local file(image, video, file)
function addFileToDB(fileID, base64, fileType) {
	let tx = db.transaction(['files'], 'readwrite');
	
	let store = tx.objectStore('files');

	var objectStoreRequest = store.get(fileID);
	
	objectStoreRequest.onsuccess = function(event) {
		if(!objectStoreRequest.result) {
			let file = {file: base64, type: fileType, timestamp: new Date().valueOf()};

			store.add(file, fileID)
		}
	};

	// tx.oncomplete = function() { 

	// }

	tx.onerror = function(event) {
		console.log('error storing note files' + event.target.errorCode);
	}
}

function deleteExpiredFileKey() {
	let tx = db.transaction(['files'], 'readwrite');
	
	let store = tx.objectStore('files');
	
	if(expiredKey.length > 0) {
		for(let i in expiredKey) {
			store.delete(expiredKey[i])
		}
	}
}

(function() {
	if (!window.indexedDB) {
		console.log("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
	}

	var dbTapTalk = indexedDB.open('tapFiles', 1);

	dbTapTalk.onupgradeneeded = function(event) {
		db = event.target.result;
		let notes = db.createObjectStore('files');
	}

	dbTapTalk.onsuccess = function(event) {
        db = event.target.result;

        let tx = db.transaction(['files'], 'readwrite');

        let store = tx.objectStore('files');

        var objectStoreRequest = store.getAll();

        var objectKeyRequest = store.getAllKeys();

        objectStoreRequest.onsuccess = function(event) {
            if(!objectStoreRequest.result) {
                let file = {file: base64, type: fileType, timestamp: new Date().valueOf()};

                store.add(file, fileID)
            }
        };
        
        objectKeyRequest.onsuccess = function(event) {
            for(let i in objectKeyRequest.result) {
                module.exports.tapCoreChatRoomManager.getFileFromDB(objectKeyRequest.result[i], function(data) {
                    //two weeks from now will be deleted
                    if((new Date().valueOf()-data.timestamp) > 1576155138) {
                        expiredKey.push(objectKeyRequest.result[i]);
                    }
                    
                    if(i === ((objectKeyRequest.result.length - 1).toString())) {
                        deleteExpiredFileKey();
                    }
                })
            }
        };
    }

    dbTapTalk.onerror = function(event) {
		console.log('error opening database ' + event.target.errorCode);
	}
})();

var authenticationHeader = {
    // "Content-Type": "application/json",
    "App-Key": "",
    "Authorization": "",
    "Device-Identifier": "",
    "Device-Model": navigator.appName,
    "Device-Platform": "web",
    // "Server-Key": ""
};

var baseApiUrl = "";
var webSocket = null;

const ROOM_TYPE = {
    PERSONAL: 1,
    GROUP: 2,
    CHANNEL: 3
}

const KEY_PASSWORD_ENCRYPTOR = "kHT0sVGIKKpnlJE5BNkINYtuf19u6+Kk811iMuWQ5tM";

//listen connection status
window.addEventListener('offline', function() {
	isNeedToCallApiUpdateRoomList = true;
});
//listen connection status

function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(2).replace('.00', '') + ' ' + sizes[i];
}

function getDeviceID() {
	let localDeviceID = localStorage.getItem('tapTalk.DeviceID');

	let md5DeviceID = md5(navigator.userAgent + "@" + new Date().valueOf());

	let generateDeviceID = md5DeviceID.substring(0, 16) + "-" + guid();

	if(localDeviceID !== null) {
		return localDeviceID;
	}

	localStorage.setItem('tapTalk.DeviceID', generateDeviceID);

	return generateDeviceID;
}

class WebWorker {
    constructor(worker) {
      const code = worker.toString();
      const blob = new Blob(["(" + code + ")()"]);
      return new Worker(URL.createObjectURL(blob));
    }
}

// var reader  = new FileReader();

const SOCKET_START_TYPING = "chat/startTyping";
const SOCKET_STOP_TYPING = "chat/stopTyping";
const EVENT_OPEN_ROOM = "chat/openRoom";
const SOCKET_CLOSE_ROOM = "chat/closeRoom";
const SOCKET_NEW_MESSAGE = "chat/sendMessage";
const SOCKET_UPDATE_MESSAGE = "chat/updateMessage";
const SOCKET_DELETE_MESSAGE = "chat/deleteMessage";
const SOCKET_OPEN_MESSAGE = "chat/openMessage";
const SOCKET_AUTHENTICATION = "user/authentication";
const SOCKET_USER_ONLINE_STATUS = "user/status";
const SOCKET_USER_UPDATED = "user/updated";     
const CHAT_MESSAGE_TYPE_TEXT = 1001;
const CHAT_MESSAGE_TYPE_IMAGE = 1002;
const CHAT_MESSAGE_TYPE_VIDEO = 1003;
const CHAT_MESSAGE_TYPE_FILE = 1004;
const CHAT_MESSAGE_TYPE_LOCATION = 1005;
const CHAT_MESSAGE_TYPE_CONTACT = 1006;
const CHAT_MESSAGE_TYPE_STICKER = 1007;
const CHAT_MESSAGE_TYPE_VOICE = 1008;
const CHAT_MESSAGE_TYPE_AUDIO = 1009;
const CHAT_MESSAGE_TYPE_PRODUCT = 2001;
const CHAT_MESSAGE_TYPE_CATEORY = 2002;
const CHAT_MESSAGE_TYPE_PAYMENT_CONFIRMATION = 2004;
const CHAT_MESSAGE_TYPE_SYSTEM_MESSAGE = 9001;
const CHAT_MESSAGE_TYPE_UNREAD_MESSAGE_IDENTIFIER = 9002;

const MESSAGE_ID = "0";

function doXMLHTTPRequest(method, header, url, data, isMultipart= false) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();

        xhr.open(method, url, true);

        for(let headerVal in header) {
            xhr.setRequestHeader(headerVal, header[headerVal]);        
        }

        xhr.send(method === 'POST' && isMultipart ? data : JSON.stringify(data));
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.response));
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };

        xhr.onerror = function () {
            reject({
                status: xhr.status,
                statusText: xhr.statusText
            });
        };
    });
}

function doXMLHTTPRequestToBase64(method, header, url, data, message, onProgress) {
    let sendProgressDownload = async (oEvent) => {
		if (oEvent.lengthComputable) {
		  var percentComplete = oEvent.loaded / oEvent.total * 100;
		  onProgress(message, Math.round(percentComplete * 10) / 10, oEvent.loaded);
		}
	}

    return new Promise(function (resolve, reject) {
		let xhrBase64 = new XMLHttpRequest();
		
		xhrBase64.addEventListener("progress", sendProgressDownload);

        xhrBase64.open(method, url, true);

        for(let headerVal in header) {
            xhrBase64.setRequestHeader(headerVal, header[headerVal]);        
		}
		
		xhrBase64.responseType = 'arraybuffer';

        xhrBase64.send(JSON.stringify(data));
        
        xhrBase64.onload = function() {
			if (xhrBase64.status === 200) {
				let convertToBase64 = () => {
					let uInt8Array = new Uint8Array(xhrBase64.response);
					let i = uInt8Array.length;
					let binaryString = new Array(i);

					while (i--) {
						binaryString[i] = String.fromCharCode(uInt8Array[i]);
					}

					let data = binaryString.join('');

					let base64 = window.btoa(data);

					return base64;
				};
				
				if(xhrBase64.getResponseHeader('content-type') === "application/json") {
					var enc = new TextDecoder("utf-8");
					resolve(JSON.parse(enc.decode(xhrBase64.response)));
				}else {
					resolve({
						base64: convertToBase64(),
						contentType: xhrBase64.getResponseHeader('content-type')
					});
				}
            } else {
                reject({
                    status: xhrBase64.status,
                    statusText: xhrBase64.statusText
                });
            }
        };

        xhrBase64.onerror = function () {
            reject({
              status: xhrBase64.status,
              statusText: xhrBase64.statusText
            });
        };
    });
}

function doXMLHTTPRequestUpload(method, header, url, data, onProgress) {
	let sendProgressUpload = async (oEvent) => {
		if (oEvent.lengthComputable) {
          var percentComplete = Math.round((oEvent.loaded / oEvent.total * 100) * 10) / 10;
          onProgress(percentComplete, oEvent.loaded);
		}
	}

    return new Promise(function (resolve, reject) {
        let xhrUpload = new XMLHttpRequest();

        xhrUpload.open(method, url, true);

        for(let headerVal in header) {
            xhrUpload.setRequestHeader(headerVal, header[headerVal]);        
		}
		
		xhrUpload.upload.addEventListener("progress", sendProgressUpload);

		xhrUpload.send(data);
        
        xhrUpload.onload = function() {
            if (xhrUpload.status === 200) {
                resolve(JSON.parse(xhrUpload.response));
            } else {
                reject({
                    status: xhrUpload.status,
                    statusText: xhrUpload.statusText
                });
            }
        };

        xhrUpload.onerror = function () {
            reject({
              status: xhrUpload.status,
              statusText: xhrUpload.statusText
            });
        };
    });
}

function getLocalStorageObject(storage) {
    return JSON.parse(decryptKey(localStorage.getItem(storage), KEY_PASSWORD_ENCRYPTOR));
}

function generateHeaderQuerystring() {
    let keys = {
        "content_type": authenticationHeader["Content-Type"],
        "app_key": authenticationHeader["App-Key"],
        "authorization": `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`,
        "device_identifier": authenticationHeader["Device-Identifier"],
        "device_model": authenticationHeader["Device-Model"],
        "device_platform": "web",
    }

    var s = [];
    for (var i in keys) {
        s.push(i + "=" + encodeURIComponent(keys[i]));
    }

    return s.join("&");
}

function setUserDataStorage(response) {
    let data = response;
    data.logout = false;
    return localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(data), KEY_PASSWORD_ENCRYPTOR));
}


function guid() {
    let guidChar = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
    let result = "";
    let guidCharLength = guidChar.length;
    
    for (var i = 0; i < 32; i++) {
      result += guidChar.charAt(Math.floor(Math.random() * guidCharLength));
    }

    return result;
}

function isFileAllowed(fileType, file) {
    let fileTypeAllowed = false;
    
    for (let type in fileType) {
        if(fileType[type] === file) {
            fileTypeAllowed = true;
        }
    }

    return fileTypeAllowed;
}

var tapReader = new FileReader();

tapReader.onload = function () {
	var messages = this.result.split('\n');
	for (let i in messages) {
      var m = JSON.parse(messages[i]);
      
      handleEmit(m);
	 
      switch(m.eventName) {
        case "chat/sendMessage":
            for(let i in tapMessageListeners) {
                tapMessageListeners[i].onReceiveNewMessage(m.data);
            }
            break;

        case "chat/updateMessage":
            for(let i in tapMessageListeners) {
                tapMessageListeners[i].onReceiveUpdateMessage(m.data);
            }
            break;

        case "chat/startTyping":
            for(let i in tapRoomStatusListeners) {
                tapRoomStatusListeners[i].onReceiveStartTyping(m.data.roomID, m.data.user);
            }
            break;

        case "chat/stopTyping":
            for(let i in tapRoomStatusListeners) {
                tapRoomStatusListeners[i].onReceiveStopTyping(m.data.roomID, m.data.user);
            }
            break;

        case "user/status":
            for(let i in tapRoomStatusListeners) {
                tapRoomStatusListeners[i].onReceiveOnlineStatus(m.data.user, m.data.isOnline, m.data.lastActive);
            }
            break;
      }
    }
    
    tapMsgQueue.processNext();
};

function handleEmit(emit) {
	switch(emit.eventName) {
		case "chat/sendMessage":
				handleNewMessage(emit.data)
				break;

		case "chat/updateMessage":
				handleUpdateMessage(emit.data);
			break;
	}
}

var handleNewMessage = (message) => {
    let _this = this;
    let user = this.taptalk.getTaptalkActiveUser();

    let removeRoom = (roomID) => {
        delete tapTalkRoomListHashmap[roomID];

        if(tapTalkRoomListHashmapPinned[roomID]) {
            delete tapTalkRoomListHashmapPinned[roomID];
        }

        if(tapTalkRoomListHashmapUnPinned[roomID]) {
            delete tapTalkRoomListHashmapUnPinned[roomID];
        }

		delete tapTalkRooms[roomID];
	}
    
    let mergeTaptalkRooms = (obj, src) => {
		for (var key in src) {
			if (src.hasOwnProperty(key)) obj[key] = src[key];
		}
		return obj;
	}
	
	if(user.userID !== message.user.userID) {
		this.tapCoreMessageManager.markMessageAsDelivered([message.messageID]);
	}

	message.body = decryptKey(message.body, message.localID);

	if(message.data !== "") {
		message.data = JSON.parse(decryptKey(message.data, message.localID));
    }
    
    if(message.quote.content !== "") {
		message.quote.content = decryptKey(message.quote.content, message.localID);
	}

	let isRoomExist = tapTalkRooms[message.room.roomID];
	
	if(isRoomExist) {
		if(!isRoomExist.messages[message.localID]) {
			tapTalkRooms[message.room.roomID].messages = Object.assign({[message.localID] : message}, tapTalkRooms[message.room.roomID].messages);

			var currentIndex = tapTalkRooms[message.room.roomID];

			delete tapTalkRooms[message.room.roomID];

			tapTalkRooms = Object.assign({[message.room.roomID] : currentIndex}, tapTalkRooms);
		}else {
            isRoomExist.messages[message.localID] = message;
        }
	}else {
		var roomID = message.room.roomID;

		var newRoom = {
			[roomID]: {
				messages: {},
				hasMore: true,
				lastUpdated: 0
			}
		}

		newRoom[roomID].messages[message.localID] = message;
		tapTalkRooms = mergeTaptalkRooms(newRoom, tapTalkRooms);
	}

    module.exports.tapCoreRoomListManager.setRoomListLastMessage(message, 'new emit');
    
    //if delete room
	if(message.action === 'room/delete' && message.type === CHAT_MESSAGE_TYPE_SYSTEM_MESSAGE) {
		removeRoom(message.room.roomID);
    }
    
    //if leave group
	if((message.action === 'room/leave' && message.type === 9001) && module.exports.taptalk.getTaptalkActiveUser().userID === message.user.userID) {
		removeRoom(message.room.roomID);
	}

    //handle pin - unpin
    if(window.Worker) {
        //new pinned
        if(message.action === "message/pin" && taptalkPinnedMessageIDHashmap[message.room.roomID] && !taptalkPinnedMessageIDHashmap[message.room.roomID][message.data.messageID]) {
            let _messagePin = {...message};
            let newMes = _messagePin.data;
            newMes.body =  decryptKey(newMes.body, newMes.localID);
            newMes.created = newMes.createdTime;

            if(newMes.data !== "") {
                newMes.data = decryptKey(newMes.data, newMes.localID);
            }

            var newPinMessagePinned = new WebWorker(() => self.addEventListener('message', function(e) {
                let {_pinnedMessage, _pinnedMessageID, _message, _roomID, isClose} = e.data;
                
                if(!isClose) {
                    if(_pinnedMessageID[_roomID]) {
                        _pinnedMessageID[_roomID][_message.messageID] = true;
                    }
        
                    if(_pinnedMessage[_roomID]) {
                        _pinnedMessage[_roomID].messages.push(_message);
                    }else {
                        _pinnedMessage[_roomID] = {
                            hasMore: false,
                            messages: [_message],
                            pageNumber: 1,
                            totalItems: 1,
                            totalPages: 1
                        };
                        
                    }

                    self.postMessage({
                        result: {
                            _taptalkPinnedMessageHashmap: _pinnedMessage,
                            _taptalkPinnedMessageIDHashmap: _pinnedMessageID
                        }
                    })
                }else {
                    self.close();
                }
            }));
        
            newPinMessagePinned.postMessage({
                _pinnedMessage: taptalkPinnedMessageHashmap,
                _pinnedMessageID: taptalkPinnedMessageIDHashmap,
                _message: newMes,
                _roomID: message.room.roomID
            });
        
            newPinMessagePinned.addEventListener('message', (e) => {
                let { result } = e.data;
                
                taptalkPinnedMessageIDHashmap = result._taptalkPinnedMessageIDHashmap;
                taptalkPinnedMessageHashmap = result._taptalkPinnedMessageHashmap;

                module.exports.taptalkHelper.orderArrayFromLargestToSmallest(taptalkPinnedMessageHashmap[message.room.roomID].messages, "created", "desc", (new_arr) => {
                    taptalkPinnedMessageHashmap[message.room.roomID].messages = new_arr;
                });
        
                newPinMessagePinned.postMessage({isClose: true});
            });
        }
        //new pinend

        //new unpinned
        if(message.action === "message/unpin" && taptalkPinnedMessageIDHashmap[message.room.roomID] && taptalkPinnedMessageIDHashmap[message.room.roomID][message.data.messageID]) {
            var newUnpinMessagePinned = new WebWorker(() => self.addEventListener('message', function(e) {
                let {_pinnedMessage, _pinnedMessageID, _message, _roomID, isClose} = e.data;
                
                if(!isClose) {
                    let actionRemove = () => {
                        let indexMes = _pinnedMessage[_message.room.roomID].messages.findIndex(val => val.messageID === _message.data.messageID);

                        delete _pinnedMessageID[_message.room.roomID][_message.data.messageID];
                        
                        if(indexMes !== -1) {
                            _pinnedMessage[_message.room.roomID].messages.splice(indexMes, 1);
                        }
                    }
            
                    if(_pinnedMessageID[_message.room.roomID]) {
                        actionRemove();
                    }

                    self.postMessage({
                        result: {
                            _taptalkPinnedMessageHashmap: _pinnedMessage,
                            _taptalkPinnedMessageIDHashmap: _pinnedMessageID
                        }
                    })
                }else {
                    self.close();
                }
            }));
        
            newUnpinMessagePinned.postMessage({
                _pinnedMessage: taptalkPinnedMessageHashmap,
                _pinnedMessageID: taptalkPinnedMessageIDHashmap,
                _message: message
            });
        
            newUnpinMessagePinned.addEventListener('message', (e) => {
                let { result } = e.data;
                
                taptalkPinnedMessageIDHashmap = result._taptalkPinnedMessageIDHashmap;
                taptalkPinnedMessageHashmap = result._taptalkPinnedMessageHashmap;
        
                newUnpinMessagePinned.postMessage({isClose: true});
            });
        }
        //new unpinned
    }else {
        console.log("Worker is not supported");
    }
    //handle pin - unpin
}

var handleUpdateMessage = (message) => {
    let isRoomExist = tapTalkRooms[message.room.roomID];
    
    message.body = decryptKey(message.body, message.localID);
    
    if(message.data !== "") {
        message.data = JSON.parse(decryptKey(message.data, message.localID));
    }
    
    if(message.quote.content !== "") {
        message.quote.content = decryptKey(message.quote.content, message.localID);
    }

    if(isRoomExist) {
        tapTalkRooms[message.room.roomID].messages[message.localID] = message;
        
        if(message.isRead) {
            // for(var i in tapTalkRooms[message.room.roomID].messages) {
            //     tapTalkRooms[message.room.roomID].messages[i].isRead = true;
            // }
            tapTalkRooms[message.room.roomID].messages[message.localID].isRead = true
        }
    
        module.exports.tapCoreRoomListManager.setRoomListLastMessage(message, 'update emit');
    }

    if(window.Worker) {
        //delete message pinned listener
        if(message.isDeleted) {
            var deleteMessagePinned = new WebWorker(() => self.addEventListener('message', function(e) {
                let {_pinnedMessage, _pinnedMessageID, _message, isClose} = e.data;
                
                if(!isClose) {
                    if(_pinnedMessageID[_message.room.roomID]) {
                        delete _pinnedMessageID[_message.room.roomID][_message.messageID];
                    }
    
                    if(_pinnedMessage[_message.room.roomID]) {
                        let _idx = _pinnedMessage[_message.room.roomID].messages.findIndex(v => v.messageID === _message.messageID);
    
                        if(_idx !== -1) {
                            _pinnedMessage[_message.room.roomID].messages.splice(_idx, 1);
                        }
                    }
    
                    self.postMessage({
                        result: {
                            _taptalkPinnedMessageHashmap: _pinnedMessage,
                            _taptalkPinnedMessageIDHashmap: _pinnedMessageID
                        }
                    })
                }else {
                    self.close();
                }
            }));
        
            deleteMessagePinned.postMessage({
                _pinnedMessage: taptalkPinnedMessageHashmap,
                _pinnedMessageID: taptalkPinnedMessageIDHashmap,
                _message: message
            });
        
            deleteMessagePinned.addEventListener('message', (e) => {
                let { result } = e.data;
        
                taptalkPinnedMessageHashmap = result._taptalkPinnedMessageHashmap;
                taptalkPinnedMessageIDHashmap = result._taptalkPinnedMessageIDHashmap;
        
                deleteMessagePinned.postMessage({isClose: true});
            });
        }
        //delete message pinned listener

        //edit message pinned listener
        var editMessagePinned = new WebWorker(() => self.addEventListener('message', function(e) {
            let {_pinnedMessage, _pinnedMessageID, _message, isClose} = e.data;
            
            if(!isClose) {
                if(_pinnedMessage[_message.room.roomID]) {
                    let _idx = _pinnedMessage[_message.room.roomID].messages.findIndex(v => v.messageID === _message.messageID);
        
                    if(_idx !== -1) {
                        _pinnedMessage[_message.room.roomID].messages[_idx] = _message;
                    }
                }
        
                self.postMessage({
                    result: {
                        _taptalkPinnedMessageHashmap: _pinnedMessage,
                        _taptalkPinnedMessageIDHashmap: _pinnedMessageID
                    }
                })
            }else {
                self.close();
            }
        }));
        
        editMessagePinned.postMessage({
            _pinnedMessage: taptalkPinnedMessageHashmap,
            _pinnedMessageID: taptalkPinnedMessageIDHashmap,
            _message: message
        });
        
        editMessagePinned.addEventListener('message', (e) => {
            let { result } = e.data;
        
            taptalkPinnedMessageHashmap = result._taptalkPinnedMessageHashmap;
            taptalkPinnedMessageIDHashmap = result._taptalkPinnedMessageIDHashmap;
        
            editMessagePinned.postMessage({isClose: true});
        });
        //edit message pinned listener
    }else {
        console.log("Worker is not supported");
    }
}

class TapMessageQueue {
    constructor() {
        this.queue = [];
        this.isRunning = false;
        this.callback = null;
    }
    
    setCallback(callback) {
        if (typeof(callback) !== "function") {
            throw new Error("callback must be function");
        }
        this.callback = callback;
    }
    
    addToQueue(item) {
        this.queue.push(item);
        if (!this.isRunning) {
            this.isRunning = true;
            this.processNext();
        }
    }
    
    processNext(stopIfEmpty) {
        if (this.queue.length != 0) {
            this.callback(this.queue.shift());
        } else if (!stopIfEmpty) {
            setTimeout(() => {
                this.processNext();
            }, 100);
        } else {
            this.isRunning = false;
        }
    }
}

var tapMsgQueue = new TapMessageQueue();

tapMsgQueue.setCallback((emit) => {
    tapReader.readAsText(emit);
});

class TapEmitMessageQueue {
	constructor() {
		this.emitQueue = [];
		this.isRunningMessageQueue = false;
	}

	runEmitQueue() {
		if(!navigator.onLine || !module.exports.taptalk.isConnected()) {
			this.isRunningMessageQueue = false;
		}else {
			this.isRunningMessageQueue = true;
		}

		if(this.emitQueue.length > 0 && this.isRunningMessageQueue) {
			webSocket.send(this.emitQueue[0]);
			this.emitQueue.shift();
			this.runEmitQueue();
		}else {
			this.isRunningMessageQueue = false;
			return;
		}
	}

	pushEmitQueue(emit) {
        this.emitQueue.push(emit);

		if(!this.isRunningMessageQueue) {
			this.runEmitQueue();
		}
	}
}

var tapEmitMsgQueue = new TapEmitMessageQueue();

//image compress
var urlToFile = (url, filename, mimeType) => {
	return (
		fetch(url)
			.then(function (res) { return res.arrayBuffer(); })
			.then(function (buf) { return new File([buf], filename, { type: mimeType }); })
	);
};

let compressImageFile = (file, widthVal, heightVal) => {
    return new Promise(function (resolve, reject) {;
        let fileName = file.name;
        let reader = new FileReader();
        let readerCanvasImage = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = event => {
            let img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                    let elem = document.createElement('canvas');
                    elem.width = widthVal;
                    elem.height = heightVal;
                    let ctx = elem.getContext('2d');

                    ctx.drawImage(img, 0, 0, widthVal, heightVal);

                    ctx.canvas.toBlob((blob) => {
                        let newFile = new File([blob], fileName, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        readerCanvasImage.readAsDataURL(newFile);
                    }, file.type, 0.6);                
            },
            
            reader.onerror = error => console.log(error);
        };

        readerCanvasImage.onload = event => {
            urlToFile(event.target.result, file.name, file.type)
    			.then((file) => { 
					resolve({
						file: file,
						src: event.target.result
					})
				});
        }
    })
}

exports.taptalkHelper = {
    orderArrayFromLargestToSmallest : (array, key, dir, callback) => {
        if(window.Worker) {
            var orderArrayFromLargestToSmallestWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                let {_array, _key, _dir, isClose} = e.data;

                if(!isClose) {
                    let sortArray = (a, k) => {
                        var temp = 0;
                        for (var i = 0; i < a.length; i++) {
                          for (var j = i; j < a.length; j++) {
                            if(_dir === "desc") {
                                if (a[j][k] > a[i][k]) {
                                  temp = a[j];
                                  a[j] = a[i];
                                  a[i] = temp;
                                }
                            }else {
                                if (a[j][k] < a[i][k]) {
                                    temp = a[j];
                                    a[j] = a[i];
                                    a[i] = temp;
                                }
                            }
                          }
                        }

                        return a;
                    }

                    let resultNewArray = sortArray(_array, _key);
                    
                    self.postMessage({
                        result: {
                            newArray: resultNewArray,
                            error: ""
                        }
                    })
                }else {
                    self.close();
                }
            }));
        
            orderArrayFromLargestToSmallestWorker.postMessage({
                _array: array,
                _key: key,
                _dir: dir
            });
        
            orderArrayFromLargestToSmallestWorker.addEventListener('message', (e) => {
                let { result } = e.data;
                callback(result.newArray);
                
                if(result.error !== "") {
                    console.log("Room not found")
                }
                
                orderArrayFromLargestToSmallestWorker.postMessage({isClose: true});
            });
        }else {
            console.log("Worker is not supported");
        }
    },

    helperDecryptKey(str, key) {
        return decryptKey(str, key);
    },

    helperEncryptKey(str, key) {
        return encryptKey(str, key);
    }
}

exports.taptalk = {
    forTesting : () => {
        let data = {
            // _tapTalkEmitMessageQueue: tapTalkEmitMessageQueue,
            _taptalkRooms: tapTalkRooms,
            _tapTalkRoomListHashmap: tapTalkRoomListHashmap,
            _tapTalkRoomListHashmapPinned: tapTalkRoomListHashmapPinned,
            _tapTalkRoomListHashmapUnPinned: tapTalkRoomListHashmapUnPinned,
            _emitQueuue: tapEmitMsgQueue.emitQueue
        }

        return data; 
    },

    init : (appID, appSecret, baseUrlApi) => {
        authenticationHeader["App-Key"] = btoa(`${appID}:${appSecret}`);
        // authenticationHeader["Server-Key"] = btoa(`${serverID}:${serverSecret}`);
        authenticationHeader["Device-Identifier"] = getDeviceID();
        baseApiUrl = baseUrlApi;

        this.taptalk.refreshProjectConfigs();
    },

    getDeviceID : () => {
        let localDeviceID = localStorage.getItem('tapTalk.DeviceID');

        let md5DeviceID = md5(navigator.userAgent + "@" + new Date().valueOf());

        let generateDeviceID = md5DeviceID.substring(0, 16) + "-" + guid();

        if(localDeviceID !== null) {
            return localDeviceID;
        }

        localStorage.setItem('tapTalk.DeviceID', generateDeviceID);

        return generateDeviceID;
    },

    addTapListener: (callback) => {
		tapListener.push(callback);
    },

    checkErrorResponse : (response, callbackOnMethod = null, callbackAfterRefresh = null) => {
        if(response.status !== 200) {
            if(response.status === 401) {
                if(response.error.code === "40104") {
                    this.taptalk.refreshAccessToken(callbackAfterRefresh);
                }else {
                    refreshAccessTokenCallbackArray = [];
                                    
                    for(let i  in tapListener) {
                        Object.keys(tapListener[i]).map((_callback) => {
                            if(_callback === 'onTapTalkRefreshTokenExpired') {
                                tapListener[i][_callback]();
                            }
                        })
                    }
                }
            }else {
                if(callbackOnMethod !== null) {
                    callbackOnMethod.onError(response.error.code, response.error.message)
                }
            }
        }
    },

    authenticateWithAuthTicket : (authTicket, connectOnSuccess, callback) => {
        let url = `${baseApiUrl}/v1/auth/access_token/request`;
        let _this = this;

        setTimeout(() => {
            authenticationHeader["Authorization"] = `Bearer ${authTicket}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    if(response.error.code === "") {
                        setUserDataStorage(response.data);

                        callback.onSuccess('Request access token success');
                        
                        connectOnSuccess && _this.testAccessToken(callback);
                    }else {
                        callback.onError(response.error.code, response.error.message);
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }, 300);
    },

    testAccessToken : (callback) => {
        authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;
        
        let url = `${baseApiUrl}/connect?check=1`;
        let _this = this;

        doXMLHTTPRequest('GET', authenticationHeader, url, "")
            .then(function (response) {
                if(response.error.code === "") {
                    // _this.connect(callback);
                    callback.onSuccess();
                }else {
                    _this.taptalk.checkErrorResponse(response, callback, () => {
                        _this.taptalk.testAccessToken(callback)
                    });
                } 
            })
            .catch(function (err) {
                console.error('Augh, there was an error!', err);
                setTimeout(() => {
                    _this.taptalk.testAccessToken(callback);
                }, 1000)
            });
    },

    connect : (callback) => {
        if(!isConnectRunning) {
            isConnectRunning = true;
            
            this.taptalk.testAccessToken({
                onSuccess: () => {
                    if (window["WebSocket"]) {
                        authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;
                        var url = `wss://${baseApiUrl.replace('https://', '')}/connect?${generateHeaderQuerystring()}`;
                        webSocket = new WebSocket(url);
            
                        webSocket.onopen = function () {
                            callback.onSuccess('Successfully connected to TapTalk.io server');
                            tapEmitMsgQueue.runEmitQueue();	
                            isFirstConnectedToWebSocket = true;
                        }
                        webSocket.onclose = function () {
                            callback.onClose('Disconnected from TapTalk.io server');  
                        };
                        webSocket.onerror = function () {
                            callback.onError('Error while connecting to web socket');
                        }
                        webSocket.onmessage = function (evt) {
                            if(isFirstConnectedToWebSocket) {
                                tapMsgQueue.addToQueue(evt.data);
                            }
                        };

                        isConnectRunning = false;
                    } else {
                        isConnectRunning = false;
                        alert("Your browser does not support WebSockets.");
                        callback(null, 'cannot connect to websocket');
                    }
                },
                onError: (errorCode, errorMessage) => {
                    isConnectRunning = false;
                    callback.onError((errorCode, errorMessage));
                }
            })
        }
    },

    disconnect : () => {
        return webSocket ? webSocket.close() : false;
    },

    isConnected : () => {
        return webSocket ? webSocket.readyState === 1 : false;
    },

    refreshAccessToken : (callback) => {
        let runCallbackRefreshToken = () => {
            if(refreshAccessTokenCallbackArray.length > 0) {
                refreshAccessTokenCallbackArray[0]();
                refreshAccessTokenCallbackArray.shift();
				runCallbackRefreshToken();
			}else {
				return;
			}
		};

        refreshAccessTokenCallbackArray.push(callback);
        
        if(this.taptalk.isAuthenticated()) {
            if(refreshAccessTokenCallbackArray.length < 2) {
                let url = `${baseApiUrl}/v1/auth/access_token/refresh`;

                setTimeout(() => {
                    authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').refreshToken}`;

                    doXMLHTTPRequest('POST', authenticationHeader, url, "")
                        .then(function (response) {
                            if(response.error.code === "") {
                                setUserDataStorage(response.data);

                                runCallbackRefreshToken();
                            }else {
                                refreshAccessTokenCallbackArray = [];
                                
                                for(let i  in tapListener) {
                                    Object.keys(tapListener[i]).map((callback) => {
                                        if(callback === 'onTapTalkRefreshTokenExpired') {
                                            tapListener[i][callback]();
                                        }
                                    })
                                }
                            } 
                        })
                        .catch(function (err) {
                            console.error('there was an error!', err);
                        });
                }, 300);
            }
        }else {
            return;
        }
    },

    isAuthenticated : () => {
        return (
            getLocalStorageObject("TapTalk.UserData") ? 
                getLocalStorageObject("TapTalk.UserData").accessToken ? true : false
                :
                false
        )
    },

    clearTaptalkChatData : () => {
        localStorage.removeItem('TapTalk.UserData');        
        tapTalkRooms = {}; //room list with array of messages
        tapTalkRoomListHashmap = {}; //room list last message
        tapTalkRoomListHashmapPinned = {}; //room list last message - pinned
        tapTalkRoomListHashmapUnPinned = {}; //room list last message - unpinned
        tapRoomStatusListeners = [];
        tapMessageListeners = [];
        tapListener = [];
        taptalkContact = {};
        projectConfigs = null;
        expiredKey = [];
        refreshAccessTokenCallbackArray = [];
        isConnectRunning = false;
        isDoneFirstSetupRoomList = false;
        isNeedToCallApiUpdateRoomList = true;
        isFirstConnectedToWebSocket = false;
    },

    logoutAndClearAllTapTalkData : (callback) => {
        let url = `${baseApiUrl}/v1/client/logout`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    // if(response.error.code === "") {
                    //     callback.onSuccess("Logged out successfully");
                    // }else {
                    //     if(response.error.code === "40104") {
                    //         _this.taptalk.refreshAccessToken(() => _this.taptalk.logoutAndClearAllTapTalkData(null))
                    //     }else {
                    //         callback.onError(response.error.code, response.error.message);
                    //     }
                    // }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
            
            // localStorage.removeItem('TapTalk.UserData');
            this.taptalk.clearTaptalkChatData();
            callback.onSuccess("Logged out successfully");
        }
    },

    getProjectConfigs : () => {
        return projectConfigs;
    },

    refreshProjectConfigs : (callback) => {
        let url = `${baseApiUrl}/v1/client/project_configs`;

        authenticationHeader["Authorization"] = "";

        doXMLHTTPRequest('POST', authenticationHeader, url, "")
            .then(function (response) {
                if(response.error.code === "") {
                    projectConfigs = response.data;
                }else {
                    console.log(response.error);
                }
            })
            .catch(function (err) {
                console.error('there was an error!', err);
                
            });
    },

    getTaptalkActiveUser : () => {
        let userDataStorage = getLocalStorageObject('TapTalk.UserData');
        return !userDataStorage ? null : userDataStorage.user;
    },

    refreshActiveUser : (callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: userData.user.userID})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(userData), KEY_PASSWORD_ENCRYPTOR));

                        callback.onSuccess('Successfully loaded latest user data');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.refreshActiveUser(callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    uploadUserPhoto: (file, callback) => {
        let url = `${baseApiUrl}/v1/client/user/photo/upload`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
			authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
			
			let uploadData = new FormData();

			uploadData.append("file", file);
            
            doXMLHTTPRequest('POST', authenticationHeader, url, uploadData, true)
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(userData), KEY_PASSWORD_ENCRYPTOR));
						
						// _this.taptalk.refreshActiveUser(function(response, error) {
						// 	if(response) {
						// 		callback("Upload success", null)
						// 	}else {
						// 		callback(null, "Failed refreshing active user")
						// 	}
						// })
                        // _this.taptalk.refreshActiveUser(callback)
                        callback.onSuccess('Successfully uploaded user photo');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.uploadUserPhoto(file, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getListUserPhoto : (userID, callback) => {
        let url = `${baseApiUrl}/v1/client/user/photo/get_list`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {userID: userID})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.getListUserPhoto(callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    setMainUserPhoto : (imageID, callback) => {
        let url = `${baseApiUrl}/v1/client/user/photo/set_main`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: imageID})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(userData), KEY_PASSWORD_ENCRYPTOR));
                        callback.onSuccess('Successfully set as main photo');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.setMainUserPhoto(imageID, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    deleteUserPhoto : (imageID, imageCreatedTime, callback) => {
        let url = `${baseApiUrl}/v1/client/user/photo/delete`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: imageID, createdTime: imageCreatedTime})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(userData), KEY_PASSWORD_ENCRYPTOR));
                        callback.onSuccess('Successfully delete photo');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.deleteUserPhoto(imageID, imageCreatedTime, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    updateBio : (bio, callback) => {
        let url = `${baseApiUrl}/v1/client/user/update_bio`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {bio: bio})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess('Successfully update bio');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.taptalk.updateBio(bio, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
    
    getRandomColor: (name) => {
		if (null == name || name.length == 0) {
			return 0;
		}
	
		let index = ((name.charCodeAt(0)) + name.charCodeAt(name.length - 1) + name.length) % tapTalkRandomColors.length;
	
		return tapTalkRandomColors[index];
    },

    clearUserData: () => {
		localStorage.removeItem("TapTalk.UserData");

		return "Please re-login";
    },

    generateBodyAndData: (param1, param2) => {
        return decryptKey(param1, param2);
    },

    isSavedMessageRoom: (roomID) => {
        var userID = this.taptalk.getTaptalkActiveUser().userID;
        return roomID === (`${userID}-${userID}`);
    }
}

exports.tapCoreRoomListManager = {
    getRoomListFromCache : () => {
        let arrayMessage = [];
        
		let setLastMessage = (message) => {
			for(let i in message) {
				if(!message[i].isHidden) {
					return message[i]
				}
			}
		};

		Object.keys(tapTalkRooms).forEach((value) => {            
            let unreadCount = this.tapCoreRoomListManager.getUnreadCountRoomList(tapTalkRooms[value].messages[0].room.roomID);

			arrayMessage.push({
				lastMessage: setLastMessage(tapTalkRooms[value].messages),
				unreadCount: unreadCount
			});
		})
		
		return arrayMessage;
    },
    
    setRoomListLastMessage: (message, action = null) => {
		var user = this.taptalk.getTaptalkActiveUser().userID;

		let data = {
			lastMessage: {},
			unreadCount: 0
		}

		let unreadCounter = () => {
			// if(tapTalkRoomListHashmap[message.room.roomID]) {
			// 	let count = tapTalkRoomListHashmap[message.room.roomID].unreadCount;

			// 	if(!message.isRead) {
			// 		if((user !== message.user.userID)) {
            //             if(!tapTalkRooms[message.room.roomID][message.localID]) {
            //                 count = count + 1; 

            //                 tapTalkRoomListHashmap[message.room.roomID].unreadCount = count;
            //             }
			// 		}
			// 	}else {
			// 		if(count !== 0) {
            //             if(!tapTalkRooms[message.room.roomID][message.localID]) {
            //                 count = 0;
            //                 tapTalkRoomListHashmap[message.room.roomID].unreadCount = count;
            //             }
			// 		}
            //     }
			// }

            //saved message
            if(tapTalkRoomListHashmapPinned[message.room.roomID]) {
				let count = tapTalkRoomListHashmapPinned[message.room.roomID].unreadCount;

				if(!message.isRead) {
					if((user !== message.user.userID)) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = count + 1; 

                            tapTalkRoomListHashmapPinned[message.room.roomID].unreadCount = count;
                        }
					}
				}else {
					if(count !== 0) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = 0;
                            tapTalkRoomListHashmapPinned[message.room.roomID].unreadCount = count;
                        }
					}
                }
			}

            if(tapTalkRoomListHashmapUnPinned[message.room.roomID]) {
				let count = tapTalkRoomListHashmapUnPinned[message.room.roomID].unreadCount;

				if(!message.isRead) {
					if((user !== message.user.userID)) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = count + 1; 

                            tapTalkRoomListHashmapUnPinned[message.room.roomID].unreadCount = count;
                        }
					}
				}else {
					if(count !== 0) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = 0;
                            tapTalkRoomListHashmapUnPinned[message.room.roomID].unreadCount = count;
                        }
					}
                }
			}
            //saved message
		}

		if(!message.isHidden || (message.isDeleted && message.isHidden)) {
			//first load roomlist
			if(action === null) {
				if(!tapTalkRoomListHashmap[message.room.roomID]) { //if room list not exist
					data.lastMessage = message;
					data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
                    
                    //taptalk room list hashmap
                    // tapTalkRoomListHashmap[message.room.roomID] = data;
                    
                    // if(taptalkUnreadMessageList[message.room.roomID]) {
                    //     tapTalkRoomListHashmap[message.room.roomID].isMarkAsUnread = true;
                    // }
                    //taptalk room list hashmap

                    //saved message
                    if(this.taptalk.isSavedMessageRoom(message.room.roomID)) {
                        //pinned
                        tapTalkRoomListHashmapPinned[message.room.roomID] = data;

                        if(taptalkUnreadMessageList[message.room.roomID]) {
                            tapTalkRoomListHashmapPinned[message.room.roomID].isMarkAsUnread = true;
                        }
                    }else {
                        //unpinned
                        tapTalkRoomListHashmapUnPinned[message.room.roomID] = data;

                        if(taptalkUnreadMessageList[message.room.roomID]) {
                            tapTalkRoomListHashmapUnPinned[message.room.roomID].isMarkAsUnread = true;
                        }
                    }
                    //saved message
				}else { //if room list exist
                    //taptalk room list hashmap
					// if(tapTalkRoomListHashmap[message.room.roomID].lastMessage.created < message.created) {
					// 	data.lastMessage = message;
	
					// 	tapTalkRoomListHashmap[message.room.roomID].lastMessage = data.lastMessage;
					// }
                    //taptalk room list hashmap

                    //saved message
                        //pinned
                        if(tapTalkRoomListHashmapPinned[message.room.roomID]) {
                            if(tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage.created < message.created) {
                                data.lastMessage = message;
            
                                tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage = data.lastMessage;
                            }
                        }
                        
                        //unpinned
                        if(tapTalkRoomListHashmapUnPinned[message.room.roomID]) {
                            if(tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage.created < message.created) {
                                data.lastMessage = message;
            
                                tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage = data.lastMessage;
                            }
                        }
                    //saved message

					unreadCounter();
				}
			}
			//first load roomlist

            //new emit action
			if(action === 'new emit') {
                //taptalk room list hashmap
				// if(!tapTalkRoomListHashmap[message.room.roomID]) {
                //     data.lastMessage = message;
				// 	data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;

				// 	tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmap);
				// }else {
				// 	unreadCounter();
                //     let temporaryRoomList = tapTalkRoomListHashmap[message.room.roomID];
                    
                //     if((temporaryRoomList.lastMessage.created !== message.created)) {
				// 		temporaryRoomList.lastMessage = message;
				// 	}
	
				// 	delete tapTalkRoomListHashmap[message.room.roomID];
	
				// 	tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : temporaryRoomList}, tapTalkRoomListHashmap);
				// }
                //taptalk room list hashmap

                //saved message
                if(this.taptalk.isSavedMessageRoom(message.room.roomID)) {
                    if(!tapTalkRoomListHashmapPinned[message.room.roomID]) {
                        data.lastMessage = message;
                        data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
    
                        tapTalkRoomListHashmapPinned = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmapPinned);
                    }else {
                        unreadCounter();
                        let temporaryRoomList = tapTalkRoomListHashmapPinned[message.room.roomID];
                        
                        if((temporaryRoomList.lastMessage.created !== message.created)) {
                            temporaryRoomList.lastMessage = message;
                        }
        
                        delete tapTalkRoomListHashmapPinned[message.room.roomID];

                        tapTalkRoomListHashmapPinned[message.room.roomID] = temporaryRoomList;
                    }
                }else {
                    if(!tapTalkRoomListHashmapUnPinned[message.room.roomID]) {
                        data.lastMessage = message;
                        data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
    
                        tapTalkRoomListHashmapUnPinned = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmapUnPinned);
                    }else {
                        unreadCounter();
                        let temporaryRoomList = tapTalkRoomListHashmapUnPinned[message.room.roomID];
                        
                        if((temporaryRoomList.lastMessage.created !== message.created)) {
                            temporaryRoomList.lastMessage = message;
                        }
        
                        delete tapTalkRoomListHashmapUnPinned[message.room.roomID];
        
                        tapTalkRoomListHashmapUnPinned = Object.assign({[message.room.roomID] : temporaryRoomList}, tapTalkRoomListHashmapUnPinned);
                    }
                }
                //saved message
			}
			//new emit action

			//update emit action
			if(action === 'update emit') {
                //taptalk room list hashmap
                // if(!tapTalkRoomListHashmap[message.room.roomID]) {
                //     data.lastMessage = message;
				// 	data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;

				// 	tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmap);
				// }else {
                //     if((tapTalkRoomListHashmap[message.room.roomID].lastMessage.localID === message.localID)) {
                //         tapTalkRoomListHashmap[message.room.roomID].lastMessage = message;
                //     }else {
                //         if(tapTalkRoomListHashmap[message.room.roomID].lastMessage.created < message.created) {
                //             tapTalkRoomListHashmap[message.room.roomID].lastMessage = message;
                //         }
                //     }
                    
                //     if(message.isRead) {
                //         unreadCounter();
                //     }
                // }
                //taptalk room list hashmap

                //saved message
                if(this.taptalk.isSavedMessageRoom(message.room.roomID)) {
                    if(!tapTalkRoomListHashmapPinned[message.room.roomID]) {
                        data.lastMessage = message;
                        data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
    
                        tapTalkRoomListHashmapPinned = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmapPinned);
                    }else {
                        if((tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage.localID === message.localID)) {
                            tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage = message;
                        }else {
                            if(tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage.created < message.created) {
                                tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage = message;
                            }
                        }

                        //is delete & is hidden
                        if(message.isDeleted && message.isHidden) {
                            let runIsDeleteIsHidden = () => {
                                let lastMessageLocalID = tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage.localID;
                                
                                // let firstIndexKey = Object.keys(tapTalkRooms[message.room.roomID].messages)[0];
                                
                                if(message.localID === lastMessageLocalID) {
                                    let latestMessageShow = this.tapCoreChatRoomManager.findLatestShowMessage(message.room.roomID); 
                                    
                                    if(latestMessageShow) {
                                        tapTalkRoomListHashmapPinned[message.room.roomID].lastMessage = latestMessageShow;
                                    }else {
                                        delete tapTalkRoomListHashmapPinned[message.room.roomID];
                                    }   
                                }
                            }

                            runIsDeleteIsHidden();
                        }
                        //is delete & is hidden
                        
                        if(message.isRead) {
                            unreadCounter();
                        }
                    }
                }else {
                    if(!tapTalkRoomListHashmapUnPinned[message.room.roomID]) {
                        data.lastMessage = message;
                        data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
    
                        tapTalkRoomListHashmapUnPinned = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmapUnPinned);
                    }else {
                        if((tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage.localID === message.localID)) {
                            tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage = message;
                        }else {
                            if(tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage.created < message.created) {
                                tapTalkRoomListHashmapUnPinned[message.room.roomID].lastMessage = message;
                            }
                        }
                        
                        if(message.isRead) {
                            unreadCounter();
                        }
                    }
                }
                //saved message
			}
            //update emit action
		}

        tapTalkRoomListHashmap = Object.assign({...tapTalkRoomListHashmapPinned}, {...tapTalkRoomListHashmapUnPinned});
    },

    pushNewRoomToTaptalkRooms: (roomID) => {
        tapTalkRooms[roomID] = {};

		tapTalkRooms[roomID]["messages"] = {};
		tapTalkRooms[roomID]["hasMore"] = true;
        tapTalkRooms[roomID]["lastUpdated"] = 0;
    },

    updateRoomsExist: (message) => {
        let decryptedMessage = decryptKey(message.body, message.localID);
        // let decryptedMessage = message.body;

		if(!tapTalkRooms[message.room.roomID]["messages"].localID) {
			tapTalkRooms[message.room.roomID]["messages"][message.localID] = message;
		}
		
		let _localIDNewMessage = tapTalkRooms[message.room.roomID]["messages"][message.localID];

		_localIDNewMessage.body = decryptedMessage;

		if(_localIDNewMessage.data !== "") {
			_localIDNewMessage.data = JSON.parse(decryptKey(_localIDNewMessage.data, _localIDNewMessage.localID));
		}

		//room list action
		this.tapCoreRoomListManager.setRoomListLastMessage(message);
		//room list action
	},

	updateRoomsNotExist: (message) => {
		let decryptedMessage = decryptKey(message.body, message.localID);

		tapTalkRooms[message.room.roomID] = {};

		tapTalkRooms[message.room.roomID]["messages"] = {};
		tapTalkRooms[message.room.roomID]["hasMore"] = true;
		tapTalkRooms[message.room.roomID]["lastUpdated"] = 0;

		if(!tapTalkRooms[message.room.roomID]["messages"][message.localID]) {
			tapTalkRooms[message.room.roomID]["messages"][message.localID] = message;
		}
		
		let localIDNewMessage = tapTalkRooms[message.room.roomID]["messages"][message.localID];

		localIDNewMessage.body = decryptedMessage;

		if((localIDNewMessage.data !== "") && !localIDNewMessage.isDeleted) {
			localIDNewMessage.data = JSON.parse(decryptKey(localIDNewMessage.data, localIDNewMessage.localID));
		}

        //room list action
		this.tapCoreRoomListManager.setRoomListLastMessage(message);
		//room list action
    },
    
    getUpdatedRoomList: (callback) => {
        if(navigator.onLine) {
            if(!isDoneFirstSetupRoomList) {
                this.tapCoreRoomListManager.getRoomListAndRead(callback)
            }else {
                if(isDoneFirstSetupRoomList && !isNeedToCallApiUpdateRoomList) {
                    this.tapCoreRoomListManager.getRoomListAndRead(callback)
                }else {
                    this.tapCoreRoomListManager.getRoomNewAndUpdated(callback)
                }
            }
        }else {
            callback.onSuccess(tapTalkRoomListHashmap);
        }
    },

    getRoomModelFromRoomList: (roomID) => {
        let _room = tapTalkRoomListHashmap[roomID];

        return _room;
    },
    
    updateUnreadBadgeCount: () => {
        let unreadCount = 0;
        
		if(this.taptalk.isAuthenticated()) {
			Object.keys(tapTalkRoomListHashmap).map((value) => {
				unreadCount = unreadCount + tapTalkRoomListHashmap[value].unreadCount;
			})
		}

		return unreadCount;
	},
    
    getRoomListAndRead: (callback) => {
        let url = `${baseApiUrl}/v1/chat/message/room_list_and_unread`;
		let _this = this;
		let user = this.taptalk.getTaptalkActiveUser().userID;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
			authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
			
			if(JSON.stringify(tapTalkRooms) === "{}") {
				doXMLHTTPRequest('POST', authenticationHeader, url, "")
					.then(function (response) {
						if(response.error.code === "") {
                            let data = response.data.messages;

                            let messageIDs = [];
							
							for(let i in data) {
                                if(!data[i].isDelivered && data[i].user.userID === user) {
                                    messageIDs.push(data[i].messageID);
                                }

								if(!tapTalkRooms[data[i].room.roomID]) { //if rooms not exist in rooms hashmap
									_this.tapCoreRoomListManager.updateRoomsNotExist(data[i]);
								}else {
									_this.tapCoreRoomListManager.updateRoomsExist(data[i]);
								}
                            }

                            isDoneFirstSetupRoomList = true;
                            isNeedToCallApiUpdateRoomList = false;
                            
                            _this.tapCoreMessageManager.markMessageAsDelivered(messageIDs);
                            
                            callback.onSuccess(tapTalkRoomListHashmap, tapTalkRooms);
						}else {
							_this.taptalk.checkErrorResponse(response, callback, () => {
                                _this.tapCoreRoomListManager.getRoomListAndRead(callback)
                            });
						}
					})
					.catch(function (err) {
						console.error('there was an error!', err);
					});
			}else {
				callback.onSuccess(tapTalkRoomListHashmap, tapTalkRooms);
			}
        }
    },

    getRoomNewAndUpdated: (callback) => {
		var url = `${baseApiUrl}/v1/chat/message/new_and_updated`;
		var _this = this;
		var user = this.taptalk.getTaptalkActiveUser().userID;

        if(this.taptalk.isAuthenticated()) {
            var userData = getLocalStorageObject('TapTalk.UserData');
			authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
			
			doXMLHTTPRequest('POST', authenticationHeader, url, "")
				.then(function (response) {
					if(response.error.code === "") {
						let responseNewAndUpdated = response.data.messages.reverse();
                        let messageIDs = [];
                        
                        isNeedToCallApiUpdateRoomList = false;

						if(responseNewAndUpdated.length > 0) {
							for(let i in responseNewAndUpdated) {
                                if(!responseNewAndUpdated[i].isDelivered && responseNewAndUpdated[i].user.userID === user) {
                                    messageIDs.push(responseNewAndUpdated[i].messageID);
                                }

								if(!tapTalkRooms[responseNewAndUpdated[i].room.roomID]) { //if rooms not exist in rooms hashmap
									_this.tapCoreRoomListManager.updateRoomsNotExist(responseNewAndUpdated[i]);
								}else {
									_this.tapCoreRoomListManager.updateRoomsExist(responseNewAndUpdated[i]);
								}
							}

							_this.tapCoreMessageManager.markMessageAsDelivered(messageIDs);
							
							callback.onSuccess(tapTalkRoomListHashmap, tapTalkRooms);
						}
					}else {
						_this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreRoomListManager.getRoomNewAndUpdated(callback)
                        });
					}
				})
				.catch(function (err) {
					console.error('there was an error!', err);
					
				});
        }
	},

    getUnreadCountRoomList : (roomID) => {        
        if(tapTalkRooms[roomID]) {
			let unreadCount = 0;

			for(let i in tapTalkRooms[roomID].messages) {
				if(!tapTalkRooms[roomID].messages[i].isRead && 
				   !tapTalkRooms[roomID].messages[i].isDeleted && 
				   !tapTalkRooms[roomID].messages[i].isHidden &&
				   (this.taptalk.getTaptalkActiveUser().userID !== tapTalkRooms[roomID].messages[i].user.userID)
				) {
					unreadCount++;
				}
			}

			return unreadCount;
		}else {	
			return 0;
		}
	},

    getPersonalChatRoomById(roomID, callback) {
		if(tapTalkRooms[roomID]) {
			callback(tapTalkRooms[roomID].messages, null);
		}else {
			callback(null, "Room not found");
		}
    },

    getRoomByXcID : (xcRoomID, callback) => {
		let _this = this;
        let url = `${baseApiUrl}/v1/client/room/get_by_xc_room_id`;
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {xcRoomID: xcRoomID})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreRoomListManager.getRoomByXcID(xcRoomID, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
    
    getPersonalChatRoomWithUser : (userModel) => {
        let room = {};
        let _userModel = userModel;
        let currentActiveUser = this.taptalk.getTaptalkActiveUser();
        let roomID = "";

        if(_userModel.userID < currentActiveUser) {
            roomID = _userModel.userID+"-"+currentActiveUser.userID;
        }else {
            roomID = currentActiveUser.userID+"-"+_userModel.userID;
        }

        room.roomID = roomID;
        room.name = currentActiveUser.fullname;
        room.imageURL = currentActiveUser.imageURL;
        room.type = ROOM_TYPE.PERSONAL;

        return room;
    },

    getUserByIdFromApi : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreRoomListManager.getUserByIdFromApi(userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    removeChatRoomByRoomID : (roomID) => {
		if(tapTalkRooms[roomID]) {
			delete tapTalkRooms[roomID];
		}
	},

    getMutedRooms : async (callback) => {
        let url = `${baseApiUrl}/v1/client/room/get_muted_room_ids`;
        let _this = this;
    
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
    
            doXMLHTTPRequest('POST', authenticationHeader, url, {})
                .then(function (response) {
                    if(response.error.code === "") {
                        let _muted = {};

                        response.data.mutedRooms.map((v) => {
                            _muted[v.roomID] = v;
                            return null;
                        })


                        callback.onSuccess(_muted);
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.getMutedRooms(roomID, callack)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
}

// const USER = this.taptalk.getTaptalkActiveUser();  

exports.tapCoreChatRoomManager = {
    getAllRooms : () => {
        return tapTalkRooms;
    },

    findLatestShowMessage : (roomID) => {
        let v = false;
        let _messages = tapTalkRooms[roomID].messages;

        for(let i = 0; i < Object.keys(_messages).length; i++) {
            if(!_messages[Object.keys(_messages)[i]].isHidden) {
                v = _messages[Object.keys(_messages)[i]];
                break;
            }
        }

        return v;
    },

    sendStartTypingEmit : async (roomID) => {
        let emitData = {
            eventName: SOCKET_START_TYPING,
            data: {
                roomID: roomID,
                user: this.taptalk.getTaptalkActiveUser()
            }
        };

        webSocket.send(JSON.stringify(emitData));
    },

    sendStopTypingEmit : async (roomID) => {
        let emitData = {
            eventName: SOCKET_STOP_TYPING,
            data: {
                roomID: roomID,
                user: this.taptalk.getTaptalkActiveUser()
            }
        };

        webSocket.send(JSON.stringify(emitData));
    },

    addRoomStatusListener : (callback) => {
        tapRoomStatusListeners.push(callback);
    },
    
    addMessageListener : (callback) => {	
        tapMessageListeners.push(callback);
    },
    
    generateRoom : (user, callback = null, error = null) => {
        let result = {
            success: "",
            error: {},
            room: {
				color: "",
				deleted: 0,
				imageURL: {thumbnail: "", fullsize: ""},
				isDeleted: false,
				isLocked: false,
				lockedTime: 0,
				name: "",
				roomID: "",
				type: ROOM_TYPE.PERSONAL,
				xcRoomID: ""
			}
		}

		let otherUser = user;
		let myUser = this.taptalk.getTaptalkActiveUser();
		let roomID = "";

		if(error === null) {
			result.success = true;
	
			if(parseInt(myUser.userID) > parseInt(otherUser.userID)) {
				roomID = parseInt(otherUser.userID)+"-"+parseInt(myUser.userID);
			}else {
				roomID = parseInt(myUser.userID)+"-"+parseInt(otherUser.userID);
			}
	
			result.room.roomID = roomID;
			result.room.name = otherUser.fullname;
			result.room.imageURL = otherUser.imageURL;
		}else {
			result.success = false;
			result.error = error;
        }

        if(callback !== null) {
			callback(result);
		}else {
			return result;
		}  
	},

	createRoomWithOtherUser : (userModel) => {
		return this.tapCoreChatRoomManager.generateRoom(userModel);
    },

    createRoomWithUserID : (userID, callback) => {
        this.tapCoreContactManager.getUserDataWithUserID(userID, {
			onSuccess: (user) => {
				this.tapCoreChatRoomManager.generateRoom(user.user, (response) => {
                    callback(response);
                });
			}, 
			onError: (errorCode, errorMessage) => {
				this.tapCoreChatRoomManager.generateRoom(null, (response) => {
                    callback(response);
                },
                {
					code: errorCode,
					message: errorMessage
				});
			}
		});
    },

    createRoomWithXCUserID : (xcUserID, callback) => {
		this.tapCoreContactManager.getUserDataWithXCUserID(xcUserID, {
			onSuccess: (user) => {
				this.tapCoreChatRoomManager.generateRoom(user.user, (response) => {
                    callback(response);
                });
			}, 
			onError: (errorCode, errorMessage) => {
				this.tapCoreChatRoomManager.generateRoom(null, (response) => {
                    callback(response);
                },
                {
					code: errorCode,
					message: errorMessage
				});
			}
		});
	},

    createGroupChatRoom : (groupName, participantList, callback) => {
        let url = `${baseApiUrl}/v1/client/room/create`;
        let _this = this;
        let data = {
            name: groupName,
            type: 2,
            userIDs: participantList
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        setTimeout(function() {
							callback.onSuccess(response.data.room);
						}, 3000);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.createGroupChatRoom(groupName, participantList, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    createGroupChatRoomWithPicture : (groupName, participantList, imageUri, callback) => {
        let _this = this;
        this.tapCoreChatRoomManager.createGroupChatRoom(groupName, participantList, {
            onSuccess: (room) => {
                let url = `${baseApiUrl}/v1/client/room/photo/upload`;
                let uploadData = new FormData();

                uploadData.append("roomID", room.roomID);
                uploadData.append("file", imageUri);
                
                if(_this.taptalk.isAuthenticated()) {
                    let userData = getLocalStorageObject('TapTalk.UserData');
                    authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

                    doXMLHTTPRequest('POST', authenticationHeader, url, uploadData, true)
                        .then(function (response) {
                            if(response.error.code === "") {
                                setTimeout(function() {
                                    callback.onSuccess(response.data.room);
                                }, 3000);
                            }else {
                                _this.taptalk.checkErrorResponse(response, callback, () => {
                                    _this.tapCoreChatRoomManager.createGroupChatRoomWithPicture(groupName, participantList, imageUri, callback)
                                });
                            }
                        })
                        .catch(function (err) {
                            console.error('there was an error!', err);
                            
                        });
                }
            },

            onError: (errorCode, errorMessage) => {
                console.log((errorCode, errorMessage));
            }
        })
    },

    updateGroupPicture : (groupId, imageUri, callback) => {
        let _this = this;
        let url = `${baseApiUrl}/v1/client/room/photo/upload`;
        let uploadData = new FormData();

        uploadData.append("roomID", groupId);
        uploadData.append("file", imageUri);
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequestUpload('POST', authenticationHeader, url, uploadData, callback.onProgress)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.updateGroupPicture(groupId, imageUri, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getGroupChatRoom : async (groupId, callback) => {
        let _this = this;
        let url = `${baseApiUrl}/v1/client/room/get`;
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: groupId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.getGroupChatRoom(groupId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    updateGroupChatRoomDetails : (groupId, groupName, callback) => {
        let url = `${baseApiUrl}/v1/client/room/update`;
        let _this = this;
        let data = {
            roomID: groupId,
            name: groupName
        };
           this.taptalk.isAuthenticated()
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.updateGroupChatRoomDetails(groupId, groupName, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    deleteGroupChatRoom : (roomId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/delete`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            let checksum = md5(`${roomId}:${ROOM_TYPE.GROUP}:${userData.user.userID}:${userData.accessTokenExpiry}`);
            let data = {
                roomID: roomId,
                checksum: checksum
            };
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess("Delete group chat room successfully");
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.deleteGroupChatRoom(roomId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    leaveGroupChatRoom : (groupId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/leave`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: groupId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.success, response.data.message);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.leaveGroupChatRoom(groupId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    addGroupChatMembers : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/participants/add`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.addGroupChatMembers(groupId, userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    removeGroupChatMembers : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/participants/remove`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }
        
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.removeGroupChatMembers(groupId, userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    }, 

    promoteGroupAdmins : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/admins/promote`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.promoteGroupAdmins(groupId, userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    demoteGroupAdmins : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/admins/demote`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.room);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.demoteGroupAdmins(groupId, userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    downloadMessageFile : (message, callback) => {
		let url = `${baseApiUrl}/v1/chat/file/download`;
		let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequestToBase64('POST', authenticationHeader, url, {roomID: message.room.roomID, fileID: message.data.fileID}, message, callback.onProgress)
                .then(function (response) {
					if(!response.error) {
						addFileToDB(message.data.fileID, response.base64, response.contentType);

                        callback.onSuccess(response);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreChatRoomManager.downloadMessageFile(message, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
	},

    deleteMessageByRoomID : (roomID) => {
        if(this.taptalk.isAuthenticated()) {
            delete tapTalkRoomListHashmap[roomID];

            if(!tapTalkRoomListHashmapPinned[roomID]) {
                delete tapTalkRoomListHashmapPinned[roomID];
            }

            if(!tapTalkRoomListHashmapUnPinned[roomID]) {
                delete tapTalkRoomListHashmapUnPinned[roomID];
            }

		    delete tapTalkRooms[roomID];
        }
    },

    // cancelMessageFileDownload(message, callback) {

	// }
    
    getFileFromDB(fileID, callback) {
		let tx = db.transaction(['files'], 'readwrite');
	
		let store = tx.objectStore('files');

		var objectStoreRequest = store.get(fileID);
		
		objectStoreRequest.onsuccess = function(event) {
			callback(objectStoreRequest.result);
		}
    },
    
    getCurrentChatInRoom : (roomID) => {
		if(tapTalkRooms[roomID]) {
			return tapTalkRooms[roomID].messages;
		}else {
			return null;
		}
    },

    getCurrentHasMoreChatInRoom : (roomID) => {
        if(tapTalkRooms[roomID]) {
			return tapTalkRooms[roomID].hasMore;
		}else {
			return null;
		}
    },
    
    getRoomMedia: (roomID, callback, minCreated = 0) => {
		var url = `${baseApiUrl}/v1/chat/room/get_shared_content`;
		var _this = this;
		
		let data = {
			roomID: roomID,
			minCreated: minCreated
		};
		
        if(this.taptalk.isAuthenticated()) {
			var userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
            
            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
					if(response.error.code === "") {
						let resData = response.data;
						Object.keys(resData).map((value) => {
							resData[value].map((_value) => {
								_value.data = JSON.parse(decryptKey(_value.data, _value.localID));
							})
						});

						callback.onSuccess(resData);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
							_this.tapCoreChatRoomManager.getRoomMedia(data, callback)
						});
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
    
    markChatRoomAsUnread : (roomIDs, callback) => {
        let url = `${baseApiUrl}/v1/client/room/mark_as_unread`;
        let _this = this;

        let runSetIsMarkAsUnread = async () => {
            for(let i = 0;i < roomIDs.length;i++) {
                tapTalkRoomListHashmap[roomIDs[i]].isMarkAsUnread = true;
            }

            callback.onSuccess(tapTalkRoomListHashmap);
        }

        runSetIsMarkAsUnread();

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomIDs: roomIDs})
                .then(function (response) {
                    _this.taptalk.checkErrorResponse(response, null, () => {
                        _this.tapCoreChatRoomManager.markChatRoomAsUnread(roomIDs, callback);
                    });
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
    
    getMarkedAsUnreadChatRoomList : (callback) => {
        let url = `${baseApiUrl}/v1/client/room/get_unread_room_ids`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {})
                .then(function (response) {
                    if(response.error.code === "") {
                        if(response.data.unreadRoomIDs.length > 0) {
                            response.data.unreadRoomIDs.map(val => {
                                taptalkUnreadMessageList[val] = true;
                            })
                        }
                        
						callback.onSuccess(response);
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreChatRoomManager.getMarkedAsUnreadChatRoomList(callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    }
}

exports.tapCoreMessageManager  = {
    constructTapTalkMessageModel : (messageBody, room, messageType, messageData, localID = null, forwardMessage = false) => {
        const _MESSAGE_MODEL = {
            messageID: MESSAGE_ID,
            localID: "",
            type: 0,
            body: "",
            data: "",
            filterID: "",
            isHidden: false,
            quote: {
                title: "",
                content: "",
                imageURL: "",
                fileID: "",
                fileType: ""
            },
            replyTo: {
                userID: "0",
                xcUserID: "",
                fullname: "",
                messageID: "0",
                localID: "",
                messageType: 0
            },
            forwardFrom: {
                userID: "0",
                xcUserID: "",
                fullname: "",
                messageID: "0",
                localID: ""
            },
            room: {
                roomID: "",
                name: "",
                type: "", // 1 is personal; 2 is group
                imageURL: {
                    thumbnail: "",
                    fullsize: ""
                },
                color: "",
                deleted: 0,
                isDeleted: false
            },
            user: null,
            recipientID: "0",
            action: "",
            target: {
                targetType: "",
                targetID: "0",
                targetXCID: "",
                targetName: ""
            },
            isSending: null,
            isDelivered: null,
            isRead: null,
            isDeleted: null,
            created: new Date().valueOf(),
            updated: new Date().valueOf()
        }
        
        let generateRecipient = () => {
			if(room.type === 1) {
                let roomSplit = room.roomID.split("-");
				return roomSplit[0] === this.taptalk.getTaptalkActiveUser().userID ? roomSplit[1] : roomSplit[0];
			}else {
				return "0";
			}
        }
        
        let guidVal = guid();

        let generateData = () => {
			if(typeof messageData === 'object') {
				return encryptKey(JSON.stringify(messageData), localID !== null ? localID : guidVal);
			}

			return messageData;
		}
                
        _MESSAGE_MODEL["localID"] = localID !== null ? localID : guidVal;
        _MESSAGE_MODEL["user"] = this.taptalk.getTaptalkActiveUser();
        _MESSAGE_MODEL["type"] = messageType;
        _MESSAGE_MODEL["body"] = encryptKey(messageBody, localID !==null ? localID : guidVal);
        _MESSAGE_MODEL["recipientID"] = generateRecipient();
        _MESSAGE_MODEL["data"] = generateData();
        _MESSAGE_MODEL["created"] = new Date().valueOf();
        _MESSAGE_MODEL["updated"] = new Date().valueOf();
		//set room model
		_MESSAGE_MODEL["room"] = room;
        //end of set room model
        
        //message status
        _MESSAGE_MODEL["isSending"] = true;
        _MESSAGE_MODEL["isDelivered"] = false;
        _MESSAGE_MODEL["isRead"] = false;
        _MESSAGE_MODEL["isDeleted"] = false;
        //message status

        //forward message
        if(forwardMessage) {
            if(forwardMessage.forwardFrom.fullname === "") {
                _MESSAGE_MODEL["forwardFrom"]["userID"] = forwardMessage.user.userID;
                _MESSAGE_MODEL["forwardFrom"]["xcUserID"] = forwardMessage.user.xcUserID;
                _MESSAGE_MODEL["forwardFrom"]["fullname"] = forwardMessage.user.fullname;
            }else {
                _MESSAGE_MODEL["forwardFrom"] = forwardMessage.forwardFrom;
            }
            _MESSAGE_MODEL["forwardFrom"]["messageID"] = forwardMessage.messageID;
            _MESSAGE_MODEL["forwardFrom"]["localID"] = forwardMessage.localID;
            _MESSAGE_MODEL["forwardFrom"]["roomID"] = forwardMessage.room.roomID;
        }
        //forward message

        return _MESSAGE_MODEL;
    },

    constructTapTalkMessageModelWithQuote : (messageBody, room, messageType, messageData, quotedMessage = false, localID = null, quoteTitle = false, quoteContent = false, quoteImageUrl = false) => {
        const _MESSAGE_MODEL = {
            messageID: MESSAGE_ID,
            localID: "",
            type: 0,
            body: "",
            data: "",
            filterID: "",
            isHidden: false,
            quote: {
                title: "",
                content: "",
                imageURL: "",
                fileID: "",
                fileType: ""
            },
            replyTo: {
                userID: "0",
                xcUserID: "",
                fullname: "",
                messageID: "0",
                localID: "",
                messageType: 0
            },
            forwardFrom: {
                userID: "0",
                xcUserID: "",
                fullname: "",
                messageID: "0",
                localID: ""
            },
            room: {
                roomID: "",
                name: "",
                type: "", // 1 is personal; 2 is group
                imageURL: {
                    thumbnail: "",
                    fullsize: ""
                },
                color: "",
                deleted: 0,
                isDeleted: false
            },
            user: null,
            recipientID: "0",
            action: "",
            target: {
                targetType: "",
                targetID: "0",
                targetXCID: "",
                targetName: ""
            },
            isSending: null,
            isDelivered: null,
            isRead: null,
            isDeleted: null,
            created: new Date().valueOf(),
            updated: new Date().valueOf()
        };
        
        let generateRecipient = () => {
			if(room.type === 1) {
                let roomSplit = room.roomID.split("-");
				return roomSplit[0] === this.taptalk.getTaptalkActiveUser().userID ? roomSplit[1] : roomSplit[0];
			}else {
				return "0";
			}
        }
        
        let guidVal = guid();

        let generateData = () => {
			if(typeof messageData === 'object') {
				return encryptKey(JSON.stringify(messageData), localID !== null ? localID : guidVal);
			}

			return messageData;
		}
                
        _MESSAGE_MODEL["localID"] = localID !== null ? localID : guidVal;
        _MESSAGE_MODEL["user"] = this.taptalk.getTaptalkActiveUser();
        _MESSAGE_MODEL["type"] = messageType;
        _MESSAGE_MODEL["body"] = encryptKey(messageBody, localID !==null ? localID : guidVal);
        _MESSAGE_MODEL["recipientID"] = generateRecipient();
        _MESSAGE_MODEL["data"] = generateData();
        _MESSAGE_MODEL["created"] = new Date().valueOf();
        _MESSAGE_MODEL["updated"] = new Date().valueOf();
		//set room model
		_MESSAGE_MODEL["room"] = room;
        //end of set room model
        
        //message status
        _MESSAGE_MODEL["isSending"] = true;
        _MESSAGE_MODEL["isDelivered"] = false;
        _MESSAGE_MODEL["isRead"] = false;
        _MESSAGE_MODEL["isDeleted"] = false;
        //message status
        
        //quote
        if(quotedMessage) {
            let isFileUsingFileID = !quotedMessage ? false : quotedMessage.type === CHAT_MESSAGE_TYPE_FILE || quotedMessage.type === CHAT_MESSAGE_TYPE_VIDEO || quotedMessage.type === CHAT_MESSAGE_TYPE_IMAGE;
            let _quoteTitle = "";
            let _quoteContent = "";

            //title
            if(quoteTitle) {
                _quoteTitle = quoteTitle;
            }else {
                if(quotedMessage.type === CHAT_MESSAGE_TYPE_FILE) {
                    _quoteTitle = quotedMessage.data.fileName.split(".")[0];
                }else {
                    _quoteTitle = (quotedMessage.forwardFrom && quotedMessage.forwardFrom.fullname !== "") ? quotedMessage.forwardFrom.fullname : quotedMessage.user.fullname;
                }
            }
            
            //title

            //content
            if(quotedMessage.type === CHAT_MESSAGE_TYPE_FILE) {
                _quoteContent = bytesToSize(quotedMessage.data.size) + " " + quotedMessage.data.fileName.split(".")[quotedMessage.data.fileName.split(".").length - 1].toUpperCase();
            }else {
                _quoteContent = quotedMessage.body;
            }
            //content

            _MESSAGE_MODEL["quote"]["content"] = _quoteContent;
            _MESSAGE_MODEL["quote"]["content"] = encryptKey(_MESSAGE_MODEL["quote"]["content"], _MESSAGE_MODEL["localID"]);
            _MESSAGE_MODEL["quote"]["fileID"] = isFileUsingFileID ? quotedMessage.data.fileID : "";
            _MESSAGE_MODEL["quote"]["fileType"] = isFileUsingFileID ? (quotedMessage.type === CHAT_MESSAGE_TYPE_FILE ? "file" : (quotedMessage.type === CHAT_MESSAGE_TYPE_IMAGE ? "image" : "video")) : "";
            _MESSAGE_MODEL["quote"]["imageURL"] = quotedMessage.type === CHAT_MESSAGE_TYPE_IMAGE ? (quotedMessage.data.fileURL ? quotedMessage.data.fileURL : "") : "";
            _MESSAGE_MODEL["quote"]["videoURL"] =  quotedMessage.type === CHAT_MESSAGE_TYPE_VIDEO ? (quotedMessage.data.fileURL ? quotedMessage.data.fileURL : "") : "";
            _MESSAGE_MODEL["quote"]["title"] = _quoteTitle;
        }else {
            _MESSAGE_MODEL["quote"]["content"] = quoteContent;
            _MESSAGE_MODEL["quote"]["content"] = encryptKey(_MESSAGE_MODEL["quote"]["content"], _MESSAGE_MODEL["localID"]);
            _MESSAGE_MODEL["quote"]["imageURL"] = quoteImageUrl;
            _MESSAGE_MODEL["quote"]["title"] = quoteTitle;
        }
        //quote

        // reply to
        // if(quotedMessage && !quoteContent && !quoteTitle && !quoteImageUrl ) {
        if(quotedMessage) {
            _MESSAGE_MODEL["replyTo"]["fullname"] = quotedMessage.user.fullname;
            _MESSAGE_MODEL["replyTo"]["localID"] = quotedMessage.localID;
            _MESSAGE_MODEL["replyTo"]["messageID"] = quotedMessage.messageID;
            _MESSAGE_MODEL["replyTo"]["messageType"] = quotedMessage.type;
            _MESSAGE_MODEL["replyTo"]["userID"] = quotedMessage.user.userID;
            _MESSAGE_MODEL["replyTo"]["xcUserID"] = quotedMessage.user.xcUserID;
        }
        // reply to

        return _MESSAGE_MODEL;
    },

    constructTapTalkProductModelWithProductID : (id, name, currency, price, rating, weight, description, imageUrl, buttonOption1Text, buttonOption2Text, buttonOption1Color, buttonOption2Color) => {
        let data = {
            id: id,
            name: name, 
            currency: currency,
            price: price,
            rating: rating,
            weight: weight,
            description: description,
            imageUrl: imageUrl,
            buttonOption1Text: buttonOption1Text, 
            buttonOption2Text: buttonOption2Text, 
            buttonOption1Color: buttonOption1Color, 
            buttonOption2Color: buttonOption2Color
        }
        
        return data;
    },

    constructMessageStatus : (isSending, isDelivered, isRead, isDeleted) => {
        MESSAGE_MODEL["isSending"] = isSending;
        MESSAGE_MODEL["isDelivered"] = isDelivered;
        MESSAGE_MODEL["isRead"] = isRead;
        MESSAGE_MODEL["isDeleted"] = isDeleted;
    },

    pushNewRoomList: (messageModel) => {
        let newRoomListHashmap = {
			lastMessage: {},
			unreadCount: 0
        }

        let user = this.taptalk.getTaptalkActiveUser().userID;
        
        newRoomListHashmap.lastMessage = messageModel;
		newRoomListHashmap.unreadCount = (!messageModel.isRead && user !== messageModel.user.userID) ? 1 : 0;

		// tapTalkRoomListHashmap = Object.assign({[messageModel.room.roomID] : newRoomListHashmap}, tapTalkRoomListHashmap);

        //saved message
        if(this.taptalk.isSavedMessageRoom(messageModel.room.roomID)) {
            tapTalkRoomListHashmapPinned = Object.assign({[messageModel.room.roomID] : newRoomListHashmap}, tapTalkRoomListHashmapPinned);
        }else {
            tapTalkRoomListHashmapUnPinned = Object.assign({[messageModel.room.roomID] : newRoomListHashmap}, tapTalkRoomListHashmapUnPinned);
        }
        //saved message
    },

    pushNewRoom: (messageModel) => {
        // let user = this.taptalk.getTaptalkActiveUser().userID;
        
		let newTaptalkRoom = {
			messages: {},
			hasMore: true,
			lastUpdated: 0
		};

		tapTalkRooms = Object.assign({[messageModel.room.roomID]: newTaptalkRoom}, tapTalkRooms);

		tapTalkRooms[messageModel.room.roomID].messages[messageModel.localID] = messageModel;

		this.tapCoreMessageManager.pushNewRoomList(messageModel);
    },
    
    pushToTapTalkEmitMessageQueue(message) {
		if(!tapTalkEmitMessageQueue[message.room.roomID]) {
			tapTalkEmitMessageQueue[message.room.roomID] = {};
			tapTalkEmitMessageQueue[message.room.roomID][message.localID] = message;
		}else {
			tapTalkEmitMessageQueue[message.room.roomID] = Object.assign({[message.localID]: message}, tapTalkEmitMessageQueue[message.room.roomID]);
		}

		// tapTalkEmitMessageQueue
    },
    
    pushNewMessageToRoomsAndChangeLastMessage : (message) => {
        let _message = {...message};

        // if(tapTalkRooms[_message.room.roomID]) {
        //     if(tapTalkRoomListHashmap[_message.room.roomID]) {
        //         tapTalkRoomListHashmap[_message.room.roomID].lastMessage = _message;
        //         tapTalkRoomListHashmap = Object.assign({[_message.room.roomID]: tapTalkRoomListHashmap[_message.room.roomID]}, tapTalkRoomListHashmap);
        //     }else {
        //         this.tapCoreRoomListManager.setRoomListLastMessage(_message, "new emit")
        //     }

        //     tapTalkRooms[_message.room.roomID].messages = Object.assign({[_message.localID]: _message}, tapTalkRooms[_message.room.roomID].messages);
        // }else {
        //     this.tapCoreMessageManager.pushNewRoom(_message);
        // }

        //saved message
        if(tapTalkRooms[_message.room.roomID]) {
            if(tapTalkRoomListHashmapPinned[_message.room.roomID]) {
                tapTalkRoomListHashmapPinned[_message.room.roomID].lastMessage = _message;
                tapTalkRoomListHashmapPinned = Object.assign({[_message.room.roomID]: tapTalkRoomListHashmapPinned[_message.room.roomID]}, tapTalkRoomListHashmapPinned);
            }else if(tapTalkRoomListHashmapUnPinned[_message.room.roomID]) {
                tapTalkRoomListHashmapUnPinned[_message.room.roomID].lastMessage = _message;
                tapTalkRoomListHashmapUnPinned = Object.assign({[_message.room.roomID]: tapTalkRoomListHashmapUnPinned[_message.room.roomID]}, tapTalkRoomListHashmapUnPinned);
            }else {
                this.tapCoreRoomListManager.setRoomListLastMessage(_message, "new emit")
            }

            tapTalkRooms[_message.room.roomID].messages = Object.assign({[_message.localID]: _message}, tapTalkRooms[_message.room.roomID].messages);
        }else {
            this.tapCoreMessageManager.pushNewRoom(_message);
        }
        // saved message
    },

    sendCustomMessage : (messageModel, callback) => {
        if(this.taptalk.isAuthenticated()) {
            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: JSON.parse(JSON.stringify(messageModel))
            };
                    
            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);

            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(messageModel);

            callback(messageModel);
                
            tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
        }
    },

    sendProductMessageWithProductArray : (arrayOfProduct, room, callback, quotedMessage = false) => {
        if(this.taptalk.isAuthenticated()) {
            this.tapCoreMessageManager.sendCustomMessage("Product List", {items: arrayOfProduct}, 2001, room, callback, quotedMessage);
        }
    },

    checkAndSendForwardedMessage : (room, callback, forwardMessage) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL = this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage);

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
            };
                    
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = forwardMessage.body;
            _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";
            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);

            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
            
            callback(_message);
            
            tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
        }
    },

    sendForwardMessage: (room, callback, forwardMessage) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL =  this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage);

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
            };
            
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = forwardMessage ? forwardMessage.body : messageBody;
            _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";
            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

            callback(_message);
            
            tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
        }
    },

    sendForwardMessages: (room, callback, forwardMessages) => {
        if(this.taptalk.isAuthenticated()) {
            forwardMessages.map((forwardMessage) => {
                let _MESSAGE_MODEL =  this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage);
    
                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: _MESSAGE_MODEL
                };
                        
                let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
    
                _message.body = forwardMessage ? forwardMessage.body : messageBody;
                _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";
                // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);
    
                this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
    
                callback(_message);
                
                tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
            })
        }
    },

    sendForwardMessagesOnMultipleRooms: (data, callback) => {
        if(this.taptalk.isAuthenticated()) {
            data.map((v) => {
                v.messages.map((forwardMessage) => {
                    let _MESSAGE_MODEL =  this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, v.room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage);
        
                    let emitData = {
                        eventName: SOCKET_NEW_MESSAGE,
                        data: _MESSAGE_MODEL
                    };
                            
                    let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
        
                    _message.body = forwardMessage ? forwardMessage.body : messageBody;
                    _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";
                    // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);
        
                    this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
        
                    callback(_message);
                    
                    tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
                })
            })
        }
    },

    sendTextMessageWithoutEmit : (messageBody, room, callback, quotedMessage = false, forwardMessage = false, quoteTitle = false) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "", quotedMessage, null, quoteTitle, false, false)
                :
                forwardMessage ?
                    this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                    :
                    this.tapCoreMessageManager.constructTapTalkMessageModel(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "")
            ;

            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = messageBody;
            _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

            callback(_message);

            if(forwardMessage) {
                this.tapCoreMessageManager.sendTextMessage(messageBody, room, callback)
            }
        }
    },

    sendTextMessage : (messageBody, room, callback, quotedMessage = false, forwardMessage = false, forwardOnly = false, quoteTitle = false) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "", quotedMessage, null, quoteTitle, false, false)
                :
                forwardMessage ?
                    this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                    :
                    this.tapCoreMessageManager.constructTapTalkMessageModel(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "")
            ;

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
            };
                    
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = forwardMessage ? forwardMessage.body : messageBody;
            _message.data = forwardMessage ? (forwardMessage.data !== "" ? forwardMessage.data : "") : "";

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }

            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);

            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

            callback(_message);
            
            tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
            
            if(forwardMessage && !forwardOnly) {
                this.tapCoreMessageManager.sendTextMessage(messageBody, room, callback, quotedMessage, forwardMessage, forwardOnly, quoteTitle)
            }
        }
    },

    sendEmitWithEditedMessage : (message, newMessage, callback) => {
        let _message = {...message};
        
        _message.isMessageEdited = true;

        if((_message.data !== "") && (typeof _message.data.caption !== "undefined")) {
            _message.data.caption = newMessage;
        }else {
            _message.body = newMessage;
        }

        let _MESSAGE_MODEL = {..._message};

        if(_message.data !== "" && typeof _message.data.caption !== "undefined") {
            _MESSAGE_MODEL.data = encryptKey(JSON.stringify(_MESSAGE_MODEL.data), _MESSAGE_MODEL.localID);
        }else if(_message.quote.title !== "") {
            _MESSAGE_MODEL.quote.content = encryptKey(JSON.stringify(_MESSAGE_MODEL.quote.content), _MESSAGE_MODEL.localID);
        }

        _MESSAGE_MODEL.body = encryptKey(_MESSAGE_MODEL.body, _MESSAGE_MODEL.localID);
        
        let emitData = {
            eventName: SOCKET_UPDATE_MESSAGE,
            data: _MESSAGE_MODEL
        };

        if(_message.localID === tapTalkRoomListHashmap[_message.room.roomID].lastMessage.localID) {
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
        }

        let actionEditStarredMessage = () => {
            let indexMes = taptalkStarMessageHashmap[_message.room.roomID].messages.findIndex(val => val.messageID === _message.messageID);

            if(indexMes !== -1) {
                taptalkStarMessageHashmap[_message.room.roomID].messages[indexMes] = _message;
            }
        }

        if(taptalkStarMessageHashmap[_message.room.roomID]) {
            actionEditStarredMessage();
        }

        callback(_message);
        
        tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
    },

    sendLocationMessage : (latitude, longitude, address, room, callback, quotedMessage = false, forwardOnly = false, quoteTitle = false) => {
        if(this.taptalk.isAuthenticated()) {
            let bodyValueLocation = `📍 Location`; 
			let data =  {
                latitude: latitude,
                longitude: longitude,
                address: address			
            }
            
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueLocation, room, CHAT_MESSAGE_TYPE_LOCATION, data, quotedMessage, null, quoteTitle, false, false)
                :
                forwardMessage ?
                    this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, data, null, forwardMessage)
                    :
                    this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueLocation, room, CHAT_MESSAGE_TYPE_LOCATION, data)
            ;

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
			};
			
			let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
			// tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
			
            _message.body = forwardMessage ? forwardMessage.body : bodyValueLocation;
            _message.data = data;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }

            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
			
			callback(_message);

			tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));

            if(forwardMessage && !forwardOnly) {
                this.tapCoreMessageManager.sendLocationMessage(latitude, longitude, address, room, callback, quotedMessage, forwardMessage, forwardOnly, quoteTitle);
            }
        }
    },

    uploadChatFile : (data, callback) => {
        let url = `${baseApiUrl}/v1/chat/file/upload`;
        let uploadData = new FormData();
        let _this = this;
        let fileType = data.file.type.split("/")[0];

        let generateBase64 = (fileID) => {
			let readerUploadData = new FileReader();
			readerUploadData.readAsDataURL(data.file);

			readerUploadData.onload = function () {
				addFileToDB(fileID, readerUploadData.result.split(',')[1], data.file.type);
			};

			readerUploadData.onerror = function (error) {
				console.log('Error: ', error);
			};
		}

        uploadData.append("roomID", data.room);
        uploadData.append("file", data.file);
        uploadData.append("caption", data.caption);
        uploadData.append("fileType", ((fileType === "image" || fileType === "video" || fileType === "audio") ? fileType : "file")); 

        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
            doXMLHTTPRequestUpload('POST', authenticationHeader, url, uploadData, callback.onProgress)
                .then(function (response) {
                    if(response.error.code === "") {
                        let _data = {...response.data};
                        _data.url = _data.fileURL;
                        callback.onSuccess(_data);

                        generateBase64(response.data.fileID);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreMessageManager.uploadChatFile(data, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    actionSendImageMessage : (file, caption, room, callback, isSendEmit, quotedMessage, forwardMessage, fileSizeLimit, forwardOnly, quoteTitle) => {
        if(fileSizeLimit && (file.size > fileSizeLimit)) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(fileSizeLimit));
        }else if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(projectConfigs.core.chatMediaMaxFileSize));
        }else {
            let bodyValueImage = `${caption !== "" ? `🖼 ${caption}` : '🖼 Photo'}`;
            const MAX_IMAGE_HEIGHT = 2000;
			const MAX_IMAGE_WIDTH = 2000;
            let imageWidth = "";
            let imageHeight = "";
            let aspectRatio = "";
            let _URL = window.URL || window.webkitURL;
            let img = new Image();

            img.onload = function () {
				aspectRatio = this.width / this.height;
				imageHeight = this.height;
				imageWidth = this.width;
				//check image width and height
				if(imageWidth > MAX_IMAGE_WIDTH) {
					imageWidth = 2000;
					imageHeight = Math.floor(imageWidth / aspectRatio);
				}
				
				if(imageHeight > MAX_IMAGE_HEIGHT) {
					imageHeight = 2000;
					imageWidth = Math.floor(imageHeight * aspectRatio);
				}
				//check image width and height
			};
            
            img.src = _URL.createObjectURL(file);

            let _this = this;

            compressImageFile(new File ([file], file.name, {type: file.type}), 20, 20).then(function(resultThumbnail) {
				let thumbnailImage = resultThumbnail.src;
				
				compressImageFile(new File ([file], file.name,  {type: file.type}), imageWidth, imageHeight).then(function(res) {
                    let currentLocalID = guid();
                  
                    let uploadData = {
                        file: {...res}.file,
                        caption: caption,
                        room: room.roomID
                    };

                    let data = "";

                    if(forwardMessage && forwardMessage.data !== "") {
                        data = forwardMessage.data;
                    }else {
                        data = {
                            fileName: file.name,
                            mediaType: file.type,
                            size: file.size,
                            fileID: "",
                            thumbnail: thumbnailImage.split(',')[1],
                            width: imageWidth,
                            height: imageHeight,
                            caption: caption
                        };
                    }

                    let _MESSAGE_MODEL = quotedMessage ? 
                        _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueImage, room, CHAT_MESSAGE_TYPE_IMAGE, data, quotedMessage, currentLocalID, quoteTitle, false, false)
                        :
                        forwardMessage ?
                            _this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                            :
                            _this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueImage, room, CHAT_MESSAGE_TYPE_IMAGE, data, currentLocalID)
                    ;
    
                    let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

                    _message.body = forwardMessage ? forwardMessage.body : bodyValueImage;
                    _message.data = data;
                    
                    if(quotedMessage) {
                        _message.quote.content = quotedMessage.body;
                    }
                    
                    _this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

                    if(forwardMessage) {
                        let emitData = {
                            eventName: SOCKET_NEW_MESSAGE,
                            data: _MESSAGE_MODEL
                        };
                        
                        callback.onStart(_message);
                        tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));

                        if(!forwardOnly) {
                            _this.tapCoreMessageManager.sendImageMessage(file, caption, room, callback, false, false, false, quoteTitle);
                        }
                    }else {
                        _message.bytesUpload = 0;
                        _message.percentageUpload = 0;
                        callback.onStart(_message);
                        
                        tapUplQueue.addToQueue(_message.localID, {...uploadData}, {
                            onProgress: (percentage, bytes) => {
                                callback.onProgress(currentLocalID, percentage, bytes);
                            },
                
                            onSuccess: (response) => {
                                if(response) {
                                    response.fileName = file.name;
                                    let _messageForCallback = JSON.parse(JSON.stringify(_message));
                                    response.thumbnail = thumbnailImage.split(',')[1];
                                    _messageForCallback.data = response;
                                    _messageForCallback.body = bodyValueImage;
    
                                    if(quotedMessage) {
                                        _messageForCallback.quote.content = quotedMessage.body;
                                    }
                                    
                                    callback.onSuccess(_messageForCallback);
    
                                    if(isSendEmit) {
                                        let _messageClone = JSON.parse(JSON.stringify(_message));
                                        _messageClone.body = encryptKey(_messageClone.body, _messageClone.localID);
                                        _messageClone.data = encryptKey(JSON.stringify(response), _messageClone.localID);
    
                                        if(quotedMessage) {
                                            _messageClone.quote.content = encryptKey(quotedMessage.body, _messageClone.localID);
                                        }
                                        
                                        // _this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_messageClone);
                                        
                                        let emitData = {
                                            eventName: SOCKET_NEW_MESSAGE,
                                            data: _messageClone
                                        };
                                        
                                        tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
                                    }
    
                                    tapUplQueue.processNext();
                                }
                            },
                
                            onError: (errorCode, errorMessage) => {
                                callback.onError(errorCode, errorMessage);
                            }
                        });
                    }
                    
                })
            })
        }
    },

    sendImageMessage : (file, caption, room, callback, quotedMessage = false, forwardMessage = false, forwardOnly = false, quoteTitle = false) => {
        this.tapCoreMessageManager.actionSendImageMessage(file, caption, room, callback, true, quotedMessage, forwardMessage, false, forwardOnly, quoteTitle);
    },

    sendImageMessageWithoutEmit : (file, caption, room, callback, quotedMessage = false, forwardMessage = false, fileSizeLimit = false) => {
        this.tapCoreMessageManager.actionSendImageMessage(file, caption, room, callback, false, quotedMessage, forwardMessage, fileSizeLimit, false);
    },

    actionSendVideoMessage : (file, caption, room, callback, isSendEmit, quotedMessage, forwardMessage, fileSizeLimit, forwardOnly, quoteTitle) => {
        if(fileSizeLimit && (file.size > fileSizeLimit)) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(fileSizeLimit));
        }else if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(projectConfigs.core.chatMediaMaxFileSize));
        }else {
            let bodyValueVideo = `${caption !== "" ? `🎥 ${caption}` : '🎥 Video'}`;
            let _this = this;

            let videoMetaData = (file) => {
                return new Promise(function(resolve, reject) {
                    let video = document.createElement('video');
                    // video.preload = 'metadata';

                    video.onloadedmetadata = function() {
                        window.URL.revokeObjectURL(video.src);
                        
                        resolve({
                            video: video,
                            duration: Math.round(video.duration * 1000),
                            height: video.videoHeight,
                            width: video.videoWidth
                        })
                    }

                    video.src = URL.createObjectURL(file);
                })
            }

            videoMetaData(file).then(function(value) {
                let videoCanvas = document.createElement('canvas');
                videoCanvas.height = value.height;
                videoCanvas.width = value.width;
                videoCanvas.getContext('2d').drawImage(value.video, 0, 0)
                // var snapshot = videoCanvas.toDataURL();
                let videoThumbnail = "iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsIAAA7CARUoSoAAAABKSURBVFhH7c4hDsAwEASxS///5zag3PTAWFotnTMz790az/9rFCQFSUFSkBQkBUlBUpAUJAVJQVKQFCQFSUFSkBQkBUlBsixo5gPuqwFROINNBAAAAABJRU5ErkJggg==";

                let currentLocalID = guid();

                let uploadData = {
                    file: file,
                    caption: caption,
                    room: room.roomID
                };

                let data = "";

                if(forwardMessage && forwardMessage.data !== "") {
                    data = forwardMessage.data;
                }else {
                    data = {
                        fileName: file.name,
                        mediaType: file.type,
                        size: file.size,
                        fileID: "",
                        thumbnail: videoThumbnail,
                        width: value.width,
                        height: value.height,
                        caption: caption,
                        duration: value.duration
                    };
                }


                let _MESSAGE_MODEL = quotedMessage ? 
                    _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueVideo, room, CHAT_MESSAGE_TYPE_VIDEO, data, quotedMessage, currentLocalID, quoteTitle, false, false)
                    :
                    forwardMessage ?
                        _this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                        :
                        _this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueVideo, room, CHAT_MESSAGE_TYPE_VIDEO, data, currentLocalID)
                ;
                
                let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
    
                _message.body = forwardMessage ? forwardMessage.body : bodyValueVideo;
                _message.data = data;
                
                if(quotedMessage) {
                    _message.quote.content = quotedMessage.body;
                }
                
                _this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
                

                if(forwardMessage) {
                    let emitData = {
                        eventName: SOCKET_NEW_MESSAGE,
                        data: _MESSAGE_MODEL
                    };
                    
                    callback.onStart(_message);
                    tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));

                    if(!forwardOnly) {
                        _this.tapCoreMessageManager.sendVideoMessage(file, caption, room, callback, false, false, false, quoteTitle);
                    }
                }else {
                    _message.bytesUpload = 0;
                    _message.percentageUpload = 0;
                    callback.onStart(_message);
                    
                    tapUplQueue.addToQueue(_message.localID, uploadData, {
                        onProgress: (percentage, bytes) => {
                            callback.onProgress(currentLocalID, percentage, bytes);
                        },
            
                        onSuccess: (response) => {
                            if(response) {
                                response.fileName = file.name;
                                let _messageForCallback = JSON.parse(JSON.stringify(_message));
                                response.thumbnail = videoThumbnail;
                                response.width = value.width;
                                response.height = value.height;
                                response.duration = value.duration;
                                _messageForCallback.data = response;
                                _messageForCallback.body = bodyValueVideo;

                                if(quotedMessage) {
                                    _messageForCallback.quote.content = quotedMessage.body;
                                }
                                    
                                callback.onSuccess(_messageForCallback);
        
                                if(isSendEmit) {
                                    let _messageClone = JSON.parse(JSON.stringify(_message));
                                    _messageClone.body = encryptKey(_messageClone.body, _messageClone.localID);
                                    _messageClone.data = encryptKey(JSON.stringify(response), _messageClone.localID);

                                    if(quotedMessage) {
                                        _messageClone.quote.content = encryptKey(quotedMessage.body, _messageClone.localID);
                                    }

                                    // _this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_messageClone);

                                    let emitData = {
                                        eventName: SOCKET_NEW_MESSAGE,
                                        data: _messageClone
                                    };
                                    
                                    tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
                                }

                                tapUplQueue.processNext();
                            }
                        },
            
                        onError: (errorCode, errorMessage) => {
                            callback.onError(errorCode, errorMessage);
                        }
                    });
                }
            })
        }
    },
    
    sendVideoMessage : (file, caption, room, callback, quotedMessage = false, forwardMessage = false, forwardOnly = false, quoteTitle = false) => {
        this.tapCoreMessageManager.actionSendVideoMessage(file, caption, room, callback, true, quotedMessage, forwardMessage, false, forwardOnly, quoteTitle);
    },

    sendVideoMessageWithoutEmit : (file, caption, room, callback, quotedMessage = false, forwardMessage = false, fileSizeLimit = false) => {
        this.tapCoreMessageManager.actionSendVideoMessage(file, caption, room, callback, false, quotedMessage, forwardMessage, fileSizeLimit);
    },

    actionSendFileMessage : (file, room, callback, isSendEmit, quotedMessage, forwardMessage, fileSizeLimit, forwardOnly, quoteTitle) => {
        if(fileSizeLimit && (file.size > fileSizeLimit)) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(fileSizeLimit));
        }else if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(projectConfigs.core.chatMediaMaxFileSize));
        }else {
            let currentLocalID = guid();
            let bodyValue = `📎 ${file.name}`;

            let uploadData = {
                file: file,
                caption: "",
                room: room.roomID
            };
            
            let data = "";

            if(forwardMessage && forwardMessage.data !== "") {
                data = forwardMessage.data;
            }else {
                data = {
                    fileName: file.name,
                    mediaType: file.type,
                    size: file.size,
                    fileID: ""
                };
            }
            
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValue, room, CHAT_MESSAGE_TYPE_FILE, data, quotedMessage, currentLocalID, quoteTitle, false, false)
                :
                forwardMessage ?
                    this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                    :
                    this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValue, room, CHAT_MESSAGE_TYPE_FILE, data, currentLocalID)
            ;
            
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = forwardMessage ? forwardMessage.body : bodyValue;
            _message.data = data;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
            
            if(forwardMessage) {
                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: _MESSAGE_MODEL
                };
                
                callback.onStart(_message);
                tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));

                if(!forwardOnly) {
                    this.tapCoreMessageManager.sendFileMessage(file, room, callback, false, false, false, quoteTitle);
                }
            }else {
                _message.bytesUpload = 0;
                _message.percentageUpload = 0;
                callback.onStart(_message);
                tapUplQueue.addToQueue(_message.localID, uploadData, {
                    onProgress: (percentage, bytes) => {
                        callback.onProgress(currentLocalID, percentage, bytes);
                    },
    
                    onSuccess: (response) => {
                        if(response) {
                            response.fileName = file.name;
                            let _messageForCallback = JSON.parse(JSON.stringify(_message));
                            _messageForCallback.data = response;
                            _messageForCallback.body = bodyValue;
    
                            if(quotedMessage) {
                                _messageForCallback.quote.content = quotedMessage.body;
                            }
                            
                            callback.onSuccess(_messageForCallback);
    
                            if(isSendEmit) {
                                let _messageClone = JSON.parse(JSON.stringify(_message));
                                _messageClone.body = encryptKey(_messageClone.body, _messageClone.localID);
                                _messageClone.data = encryptKey(JSON.stringify(response), _messageClone.localID);
    
                                if(quotedMessage) {
                                    _messageClone.quote.content = encryptKey(quotedMessage.body, _messageClone.localID);
                                }
    
                                // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_messageClone);
                                
                                let emitData = {
                                    eventName: SOCKET_NEW_MESSAGE,
                                    data: _messageClone
                                };
                                
                                tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
                            }
    
                            tapUplQueue.processNext();
                        }
                    },
    
                    onError: (error) => {
                        callback.onError(error);
                    }
                });
            }

        }
    },

    sendFileMessage : (file, room, callback, quotedMessage = false, forwardMessage = false, forwardOnly = false, quoteTitle = false) => {
        this.tapCoreMessageManager.actionSendFileMessage(file, room, callback, true, quotedMessage, forwardMessage, false, forwardOnly, quoteTitle);
    },

    sendFileMessageWithoutEmit : (file, room, callback, quotedMessage = false, forwardMessage = false, fileSizeLimit = false) => {
        this.tapCoreMessageManager.actionSendFileMessage(file, room, callback, false, quotedMessage, forwardMessage, fileSizeLimit);
    },

    actionSendVoiceMessage : (file, duration, room, callback, isSendEmit, quotedMessage, forwardMessage, forwardOnly, quoteTitle) => {
        if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
            callback.onError('90302', "Maximum file size is "+bytesToSize(projectConfigs.core.chatMediaMaxFileSize));
        }else {
            let currentLocalID = guid();
            let bodyValue = `🎤 Voice`;
    
            let uploadData = {
                file: file,
                caption: "",
                room: room.roomID
            };
            
            let data = "";
    
            if(forwardMessage && forwardMessage.data !== "") {
                data = forwardMessage.data;
            }else {
                data = {
                    fileObject: file,
                    fileName: file.name,
                    mediaType: file.type,
                    size: file.size,
                    fileID: "",
                    duration: duration
                };
            }
            
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValue, room, CHAT_MESSAGE_TYPE_VOICE, data, quotedMessage, currentLocalID, quoteTitle, false, false)
                :
                forwardMessage ?
                    this.tapCoreMessageManager.constructTapTalkMessageModel(forwardMessage.body, room, forwardMessage.type, forwardMessage.data !== "" ? forwardMessage.data : "", null, forwardMessage)
                    :
                    this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValue, room, CHAT_MESSAGE_TYPE_VOICE, data, currentLocalID)
            ;
            
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
    
            _message.body = forwardMessage ? forwardMessage.body : bodyValue;
            _message.data = data;
    
            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
            
            if(forwardMessage) {
                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: _MESSAGE_MODEL
                };
                
                callback.onStart(_message);
                tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));

                if(!forwardOnly) {
                    this.tapCoreMessageManager.sendVoiceMessage(file, duration, room, callback, false, false, false, quoteTitle);
                }
            }else {
                _message.bytesUpload = 0;
                _message.percentageUpload = 0;
                callback.onStart(_message);
                tapUplQueue.addToQueue(_message.localID, uploadData, {
                    onProgress: (percentage, bytes) => {
                        callback.onProgress(currentLocalID, percentage, bytes);
                    },
    
                    onSuccess: (response) => {
                        if(response) {
                            response.duration = duration;
                            let _messageForCallback = JSON.parse(JSON.stringify(_message));
                            _messageForCallback.data = response;
                            _messageForCallback.body = bodyValue;
    
                            if(quotedMessage) {
                                _messageForCallback.quote.content = quotedMessage.body;
                            }
                            
                            callback.onSuccess(_messageForCallback);
    
                            if(isSendEmit) {
                                let _messageClone = JSON.parse(JSON.stringify(_message));
                                _messageClone.body = encryptKey(_messageClone.body, _messageClone.localID);
                                _messageClone.data = encryptKey(JSON.stringify(response), _messageClone.localID);
    
                                if(quotedMessage) {
                                    _messageClone.quote.content = encryptKey(quotedMessage.body, _messageClone.localID);
                                }
    
                                // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_messageClone);
                                
                                let emitData = {
                                    eventName: SOCKET_NEW_MESSAGE,
                                    data: _messageClone
                                };
                                
                                tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
                            }
    
                            tapUplQueue.processNext();
                        }
                    },
    
                    onError: (error) => {
                        callback.onError(error);
                    }
                });
            }
    
        }
    },

    sendVoiceMessage : (file, duration, room, callback, quotedMessage = false, forwardMessage = false, forwardOnly = false, quoteTitle = false) => {
        this.tapCoreMessageManager.actionSendVoiceMessage(file, duration, room, callback, true, quotedMessage, forwardMessage, forwardOnly, quoteTitle);
    },

    sendVoiceMessageWithoutEmit : (file, duration, room, callback, quotedMessage = false, forwardMessage = false) => {
        this.tapCoreMessageManager.actionSendVoiceMessage(file, duration, room, callback, false, quotedMessage, forwardMessage);
    },

    messagesObjectToArray : (messages) => {
		var newObj = [];

		for (var key in messages) {
			if (!messages.hasOwnProperty(key)) return;
			var value = [key, messages[key]];
			newObj.push(value);
		}
		
		return newObj;
	},

	recreateSortedMessagesObject : (newSortedMessagesArray) => {
		var sortedObj = {};

		for (var i = 0; i < newSortedMessagesArray.length; i++) {
			sortedObj[newSortedMessagesArray[i][0]] = newSortedMessagesArray[i][1];
		}

		return sortedObj;
	},

	sortMessagesObject : (roomID) => {	
		let  _messages = tapTalkRooms[roomID].messages;

		let sortedArray = this.tapCoreMessageManager.messagesObjectToArray(_messages).sort(function(a, b) {
			return _messages[b[0]].created -_messages[a[0]].created
		});
		
		tapTalkRooms[roomID].messages = this.tapCoreMessageManager.recreateSortedMessagesObject(sortedArray);
	},

    getOlderMessagesBeforeTimestamp : (roomID, numberOfItems, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/list_by_room/before`;
		let _this = this;
		let maxCreatedTimestamp = 0;
        let objectKeyRoomListlength = 0;

        if(tapTalkRooms[roomID] && Object.keys(tapTalkRooms[roomID].messages).length > 0) {
            objectKeyRoomListlength = Object.keys(tapTalkRooms[roomID].messages).length;
            maxCreatedTimestamp = tapTalkRooms[roomID].messages[Object.keys(tapTalkRooms[roomID].messages)[objectKeyRoomListlength - 1]].created;
        }else {
            this.tapCoreRoomListManager.pushNewRoomToTaptalkRooms(roomID);
        }
		
        var data = {
            roomID: roomID,
            maxCreated: maxCreatedTimestamp,
            limit: numberOfItems
        };

        if(this.taptalk.isAuthenticated()) {
			if(tapTalkRooms[roomID]) {
				let userData = getLocalStorageObject('TapTalk.UserData');
				authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

				if(tapTalkRooms[roomID].hasMore) {
					doXMLHTTPRequest('POST', authenticationHeader, url, data)
						.then(function (response) {
							if(response.error.code === "") {
								tapTalkRooms[roomID].hasMore = response.data.hasMore;
								for(var i in response.data.messages) {
									response.data.messages[i].body = decryptKey(response.data.messages[i].body, response.data.messages[i].localID);

									if((response.data.messages[i].data !== "") && !response.data.messages[i].isDeleted) {
										var messageIndex = response.data.messages[i];
										messageIndex.data = JSON.parse(decryptKey(messageIndex.data, messageIndex.localID));
									}

									if(response.data.messages[i].quote.content !== "") {
										var messageIndex = response.data.messages[i];
										messageIndex.quote.content = decryptKey(messageIndex.quote.content, messageIndex.localID)
									}
									
									tapTalkRooms[roomID].messages[response.data.messages[i].localID] = response.data.messages[i];
								}
								
								tapTalkRooms[roomID].hasMore = response.data.hasMore;
								callback.onSuccess(tapTalkRooms[roomID].messages, response.data.hasMore);
							}else {
                                _this.taptalk.checkErrorResponse(response, callback, () => {
                                    _this.tapCoreMessageManager.getOlderMessagesBeforeTimestamp(roomID, numberOfItems, callback)
                                });
							}
						})
						.catch(function (err) {
							console.error('there was an error!', err);
						});
				}else {
					callback.onSuccess(tapTalkRooms[roomID].messages, tapTalkRooms[roomID].hasMore);
				}
			}
        }
    },

    getNewerMessagesAfterTimestamp : (roomID, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/list_by_room/after`;
		let _this = this;
		let lastUpdateTimestamp = 0;
        let getMinCreatedTimestamp = 0
        let objectKeyRoomListlength = 0;
       
        if(tapTalkRooms[roomID] && Object.keys(tapTalkRooms[roomID].messages).length > 0) {
            objectKeyRoomListlength = Object.keys(tapTalkRooms[roomID].messages).length;
            getMinCreatedTimestamp = tapTalkRooms[roomID].messages[Object.keys(tapTalkRooms[roomID].messages)[objectKeyRoomListlength - 1]].created;
            lastUpdateTimestamp =  tapTalkRooms[roomID].lastUpdated === 0 ? getMinCreatedTimestamp : tapTalkRooms[roomID].lastUpdated;
        }else {
            this.tapCoreRoomListManager.pushNewRoomToTaptalkRooms(roomID);
        }
		
        var data = {
            roomID: roomID,
            minCreated: getMinCreatedTimestamp,
            lastUpdated: lastUpdateTimestamp
        };
        
		let apiAfterRequest = () => {
			doXMLHTTPRequest('POST', authenticationHeader, url, data)
					.then(function (response) {
						if(response.error.code === "") {
							var currentRoomMessages = tapTalkRooms[roomID].messages;
							
							let responseMessage = response.data.messages.reverse();

							for(let i in responseMessage) {
								responseMessage[i].body = decryptKey(responseMessage[i].body, responseMessage[i].localID);

								if(responseMessage[i].data !== "") {
									var messageIndex = responseMessage[i];
									if(typeof messageIndex.data === "string") {
										messageIndex.data = JSON.parse(decryptKey(messageIndex.data, messageIndex.localID));
									}
								}

								if(responseMessage[i].quote.content !== "") {
									var messageIndex = responseMessage[i];
									messageIndex.quote.content = decryptKey(messageIndex.quote.content, messageIndex.localID)
								}
								
                                currentRoomMessages[responseMessage[i].localID] = responseMessage[i];
                            }

							var newAPIAfterResponse = currentRoomMessages;

							Object.keys(newAPIAfterResponse).map(i => {
								tapTalkRooms[roomID].messages[newAPIAfterResponse[i].localID] = newAPIAfterResponse[i];
								
								var lastUpdated = tapTalkRooms[roomID].lastUpdated;
								
								if(lastUpdated < newAPIAfterResponse[i].updated) {
									tapTalkRooms[roomID].lastUpdated = newAPIAfterResponse[i].updated;
								}
							});

							_this.tapCoreMessageManager.sortMessagesObject(roomID);

							callback.onSuccess(tapTalkRooms[roomID].messages);
						}else {
							_this.taptalk.checkErrorResponse(response, callback, () => {
                                _this.tapCoreMessageManager.getNewerMessagesAfterTimestamp(roomID, callback)
                            });
						}
					})
					.catch(function (err) {
						console.error('there was an error!', err);
					});
		}

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
			
			apiAfterRequest();
        }
    },

    markMessageAsRead : async (message) => {
        let url = `${baseApiUrl}/v1/chat/message/feedback/read`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {messageIDs: message})
                .then(function (response) {
                    _this.taptalk.checkErrorResponse(response, null, () => {
                        _this.tapCoreMessageManager.markMessageAsRead(message)
                    });
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    markAllMessagesInRoomAsRead : (roomID) => {
        if(window.Worker) {
            var markAllMessagesInRoomAsReadWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                let {rooms, roomID, roomList, roomListPinned, roomListUnPinned, taptalkUnreadMessageList, isClose} = e.data;
                let _resultMessages = [];
                
                if(!isClose) {
                    if(!rooms[roomID]) {
                        self.postMessage({
                            result: {
                                error: "Room not found"
                            }
                        })
                    } else {
                        Object.keys(rooms[roomID].messages).map(valMes => {
                            if(!rooms[roomID].messages[valMes].isRead) {
                                _resultMessages.push(rooms[roomID].messages[valMes].messageID)
                            }
            
                            return null;
                        })
                        
                        // roomList[roomID].isMarkAsUnread = false;

                        if(roomListPinned[roomID]) {
                            roomListPinned[roomID].isMarkAsUnread = false;
                        }

                        if(roomListUnPinned[roomID]) {
                            roomListUnPinned[roomID].isMarkAsUnread = false;
                        }

                        delete taptalkUnreadMessageList.roomID;
                
                        self.postMessage({
                            result: {
                                _taptalkUnreadMessageList: taptalkUnreadMessageList,
                                messages: _resultMessages.length === 0 ? [rooms[roomID].messages[Object.keys(rooms[roomID].messages)[0]].messageID] : _resultMessages,
                                // roomList: roomList,
                                roomListPinned: roomListPinned,
                                roomListUnPinned: roomListUnPinned,
                                error: ""
                            }
                        })
                    }
                }else {
                    self.close();
                }
            }));

            markAllMessagesInRoomAsReadWorker.postMessage({
                taptalkUnreadMessageList: taptalkUnreadMessageList,
                rooms: tapTalkRooms,
                // roomList: tapTalkRoomListHashmap,
                roomListPinned: tapTalkRoomListHashmapPinned,
                roomListUnPinned: tapTalkRoomListHashmapUnPinned,
                roomID: roomID
            });

            markAllMessagesInRoomAsReadWorker.addEventListener('message', (e) => {
                let { result } = e.data;

                // tapTalkRoomListHashmap = result.roomList;
                tapTalkRoomListHashmapPinned = result.roomListPinned;
                tapTalkRoomListHashmapUnPinned = result.roomListUnPinned;
                taptalkUnreadMessageList = result._taptalkUnreadMessageList;

                this.tapCoreMessageManager.markMessageAsRead(result.messages);
                
                if(result.error !== "") {
                    console.log("Room not found")
                }


                markAllMessagesInRoomAsReadWorker.postMessage({isClose: true});
            });
        }else {
            console.log("Worker is not supported");
        }
    },


    markMessageAsDelivered : (message) => {
        let url = `${baseApiUrl}/v1/chat/message/feedback/delivered`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {messageIDs: message})
                .then(function (response) {
                    _this.taptalk.checkErrorResponse(response, null, () => {
                        _this.tapCoreMessageManager.markMessageAsDelivered(message)
                    });
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
	
	markMessageAsDeleted : (roomID, messages, forEveryone) => {
        let url = `${baseApiUrl}/v1/chat/message/delete`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
			authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
			let data = {
				roomID: roomID,
				messageIDs: messages,
				forEveryone: forEveryone
			}

			if(tapTalkRooms[roomID]) {
				doXMLHTTPRequest('POST', authenticationHeader, url, data)
					.then(function (response) {
                        if(response.status !== 200) {
                            _this.taptalk.checkErrorResponse(response, null, () => {
                                _this.tapCoreMessageManager.markMessageAsDeleted(roomID, messages, forEveryone)
                            });
                        }
                        // else {
							// for(let i in messages) {
                            //     console.log(messages[i]);
							// 	let findIndex = tapTalkRooms[roomID].messages.findIndex(value => value.messageID === messages[i]);
							// 	tapTalkRooms[roomID].messages[findIndex].isDeleted = true;
							// }
						// }
					})
					.catch(function (err) {
						console.error('there was an error!', err);
					});
			}
        }
    },

    fetchStarredMessages : async (roomID, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/get_starred_list`;
        let _this = this;
        // let isRunApi = false;

        // if(
        //     (isLoadMore && (taptalkStarMessageHashmap[roomID] && taptalkStarMessageHashmap[roomID].hasMore)) || 
        //     !taptalkStarMessageHashmap[roomID]
        // ) {
        //     isRunApi = true;
        // }

        let runApiFetchStarredMessage = () => {
            if(this.taptalk.isAuthenticated()) {
                let userData = getLocalStorageObject('TapTalk.UserData');
                authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
    
                doXMLHTTPRequest('POST', authenticationHeader, url, {
                    roomID: roomID, 
                    pageNumber: !taptalkStarMessageHashmap[roomID] ? 1 : taptalkStarMessageHashmap[roomID].pageNumber, 
                    pageSize: 99999
                })
                    .then(function (response) {
                        if(response.error.code === "") {
                            let resHasMore = response.data.hasMore;
                            let newMes = [];

                            for(var i in response.data.messages) {
                                if(
                                    !taptalkStarMessageHashmap[roomID] || 
                                    (taptalkStarMessageHashmap[roomID].messages.findIndex(v => v.messageID === response.data.messages[i].messageID) === -1)
                                ) {
                                    response.data.messages[i].body = decryptKey(response.data.messages[i].body, response.data.messages[i].localID);
    
                                    if((response.data.messages[i].data !== "")) {
                                        var messageIndex = response.data.messages[i];
                                        messageIndex.data = JSON.parse(decryptKey(messageIndex.data, messageIndex.localID));
                                    }
    
                                    if(response.data.messages[i].quote.content !== "") {
                                        var messageIndex = response.data.messages[i];
                                        messageIndex.quote.content = decryptKey(messageIndex.quote.content, messageIndex.localID)
                                    }

                                    newMes.push(response.data.messages[i]);
                                }
                            }

                            response.data.messages = newMes;

                            if(!taptalkStarMessageHashmap[roomID]) {
                                taptalkStarMessageHashmap = Object.assign({[roomID] : response.data}, taptalkStarMessageHashmap);
                            }else {
                                let tempMes = taptalkStarMessageHashmap[roomID].messages.slice();
                                let tempPage = taptalkStarMessageHashmap[roomID].pageNumber;
                                taptalkStarMessageHashmap[roomID] = response.data;
                                taptalkStarMessageHashmap[roomID].pageNumber = tempPage;
                                taptalkStarMessageHashmap[roomID].messages = tempMes.concat(taptalkStarMessageHashmap[roomID].messages);
                            }

                            taptalkStarMessageHashmap[roomID].pageNumber =  !taptalkStarMessageHashmap[roomID].pageNumber ? (resHasMore ? 2 : 1) : (resHasMore ? (taptalkStarMessageHashmap[roomID].pageNumber + 1) : taptalkStarMessageHashmap[roomID].pageNumber);
                            callback.onSuccess(taptalkStarMessageHashmap[roomID]);
                        }else {
                            _this.taptalk.checkErrorResponse(response, null, () => {
                                _this.tapCoreMessageManager.fetchStarredMessages(roomID, callack)
                            });
                        }
                    })
                    .catch(function (err) {
                        console.error('there was an error!', err);
                    });
            }
        }

        // if(isRunApi) {
            runApiFetchStarredMessage();
        // }else {
        //     callback.onSuccess(taptalkStarMessageHashmap[roomID]);
        // }

        // if(isLoadMore) {
        //     runApiFetchStarredMessage();
        // }
    },

    getStarredMessageIds : async (roomID, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/get_starred_ids`;
        let _this = this;

        
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID})
                .then(function (response) {
                    if(response.error.code === "") {
                        if(window.Worker) {
                            var fetchAllStarredMessagesWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                                let {response, isClose} = e.data;
                                let _resultMessages = {};
                                
                                if(!isClose) {
                                    response.data.messageIDs.map(valMes => {
                                        _resultMessages[valMes] = true;
                        
                                        return null;
                                    })
                                
                                    self.postMessage({
                                        result: {
                                            messages: _resultMessages,
                                            error: ""
                                        }
                                    })
                                }else {
                                    self.close();
                                }
                            }));
                
                            fetchAllStarredMessagesWorker.postMessage({
                                response: response,
                                roomID: roomID
                            });
                
                            fetchAllStarredMessagesWorker.addEventListener('message', (e) => {
                                let { result } = e.data;
                                
                                if(result.error === "") {
                                    callback.onSuccess({
                                        roomID: roomID,
                                        messages: result.messages
                                    })
                                }else {
                                    callback.onError(result.error);
                                }
                
                                fetchAllStarredMessagesWorker.postMessage({isClose: true});
                            });
                        }else {
                            callback.onError("Worker is not supported");
                        }
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.getStarredMessageIds(roomID, callack)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    starMessage : (roomID, messageIDs, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/star`;
        let _this = this;

        if(taptalkStarMessageHashmap[roomID]) {
            taptalkStarMessageHashmap[roomID].pageNumber = 1;
            taptalkStarMessageHashmap[roomID].messages = [];
            taptalkStarMessageHashmap[roomID].totalItems = 0;
            taptalkStarMessageHashmap[roomID].totalPages = 1;
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID, messageIDs: messageIDs})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.starMessage(roomID, messageIDs, callback);
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    unstarMessage : (roomID, messageIDs, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/unstar`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`; 

            let actionRemove = () => {
                messageIDs.map(v => {
                    let indexMes = taptalkStarMessageHashmap[roomID].messages.findIndex(val => val.messageID === v);

                    if(indexMes !== -1) {
                        taptalkStarMessageHashmap[roomID].messages.splice(indexMes, 1);
                    }
                })
            }

            if(taptalkStarMessageHashmap[roomID]) {
                actionRemove();
            }

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID, messageIDs})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.unstarMessage(roomID, messageIDs, callback);
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    fetchPinnedMessages : async (roomID, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/get_pinned_list`;
        let _this = this;
        // let isRunApi = false;
    
        // if(
        //     (isLoadMore && (taptalkPinnedMessageHashmap[roomID] && taptalkPinnedMessageHashmap[roomID].hasMore)) || 
        //     !taptalkPinnedMessageHashmap[roomID]
        // ) {
        //     isRunApi = true;
        // }
    
        let runApiFetchPinnedMessage = () => {
            if(this.taptalk.isAuthenticated()) {
                let userData = getLocalStorageObject('TapTalk.UserData');
                authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
    
                doXMLHTTPRequest('POST', authenticationHeader, url, {
                    roomID: roomID, 
                    pageNumber: !taptalkPinnedMessageHashmap[roomID] ? 1 : taptalkPinnedMessageHashmap[roomID].pageNumber, 
                    pageSize: 99999
                })
                    .then(function (response) {
                        if(response.error.code === "") {
                            let resHasMore = response.data.hasMore;
                            let newMes = [];
    
                            for(var i in response.data.messages) {
                                response.data.messages[i].body = decryptKey(response.data.messages[i].body, response.data.messages[i].localID);
                                
                                if((response.data.messages[i].data !== "")) {
                                    var messageIndex = response.data.messages[i];
                                    messageIndex.data = JSON.parse(decryptKey(messageIndex.data, messageIndex.localID));
                                }
                                
                                if(response.data.messages[i].quote.content !== "") {
                                    var messageIndex = response.data.messages[i];
                                    messageIndex.quote.content = decryptKey(messageIndex.quote.content, messageIndex.localID)
                                }
                                
                                if(!taptalkPinnedMessageHashmap[roomID]) {
                                    newMes.push(response.data.messages[i]);
                                }else {
                                    let idxPinned = taptalkPinnedMessageHashmap[roomID].messages.findIndex(v => v.messageID === response.data.messages[i].messageID);
                                    
                                    if(idxPinned === -1) {
                                        newMes.push(response.data.messages[i]);
                                    }else {
                                        taptalkPinnedMessageHashmap[roomID].messages[idxPinned] = response.data.messages[i];
                                    }
                                }

                                
                                
                            }
    
                            response.data.messages = newMes;
    
                            if(!taptalkPinnedMessageHashmap[roomID]) {
                                taptalkPinnedMessageHashmap = Object.assign({[roomID] : response.data}, taptalkPinnedMessageHashmap);
                            }else {
                                let tempMes = taptalkPinnedMessageHashmap[roomID].messages.slice();
                                let tempPage = taptalkPinnedMessageHashmap[roomID].pageNumber;
                                taptalkPinnedMessageHashmap[roomID] = response.data;
                                taptalkPinnedMessageHashmap[roomID].pageNumber = tempPage;
                                taptalkPinnedMessageHashmap[roomID].messages = tempMes.concat(taptalkPinnedMessageHashmap[roomID].messages);
                            }
    
                            taptalkPinnedMessageHashmap[roomID].pageNumber =  !taptalkPinnedMessageHashmap[roomID].pageNumber ? (resHasMore ? 2 : 1) : (resHasMore ? (taptalkPinnedMessageHashmap[roomID].pageNumber + 1) : taptalkPinnedMessageHashmap[roomID].pageNumber);
                            
                            _this.taptalkHelper.orderArrayFromLargestToSmallest(taptalkPinnedMessageHashmap[roomID].messages, "created", "desc", (new_arr) => {
                                taptalkPinnedMessageHashmap[roomID].messages = new_arr;
                                callback.onSuccess(taptalkPinnedMessageHashmap[roomID]);
                            });
                        }else {
                            _this.taptalk.checkErrorResponse(response, null, () => {
                                _this.tapCoreMessageManager.fetchPinnedMessages(roomID, callack)
                            });
                        }
                    })
                    .catch(function (err) {
                        console.error('there was an error!', err);
                    });
            }
        }
    
        // if(isRunApi) {
            runApiFetchPinnedMessage();
        // }else {
        //     callback.onSuccess(taptalkPinnedMessageHashmap[roomID]);
        // }
    
        // if(isLoadMore) {
        //     runApiFetchPinnedMessage();
        // }
    },
    
    getPinnedMessageIds : async (roomID, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/get_pinned_ids`;
        let _this = this;
    
        
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
    
            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID})
                .then(function (response) {
                    if(response.error.code === "") {
                        if(window.Worker) {
                            var fetchAllPinnedMessagesWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                                let {response, isClose} = e.data;
                                let _resultMessages = {};
                                
                                if(!isClose) {
                                    response.data.pinnedMessageIDs.map(valMes => {
                                        _resultMessages[valMes] = true;
                        
                                        return null;
                                    })
                                
                                    self.postMessage({
                                        result: {
                                            messages: _resultMessages,
                                            error: ""
                                        }
                                    })
                                }else {
                                    self.close();
                                }
                            }));
                
                            fetchAllPinnedMessagesWorker.postMessage({
                                response: response,
                                roomID: roomID
                            });
                
                            fetchAllPinnedMessagesWorker.addEventListener('message', (e) => {
                                let { result } = e.data;
                                
                                if(result.error === "") {
                                    taptalkPinnedMessageIDHashmap[roomID] = result.messages;
                                    
                                    callback.onSuccess({
                                        roomID: roomID,
                                        messages: result.messages
                                    })
                                }else {
                                    callback.onError(result.error);
                                }
                
                                fetchAllPinnedMessagesWorker.postMessage({isClose: true});
                            });
                        }else {
                            callback.onError("Worker is not supported");
                        }
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.getPinnedMessageIds(roomID, callack)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    pinMessage : (roomID, messages, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/pin`;
        let _this = this;
        let messageIDs = [];
        // let messageIDsObject = {};

        messages.map(v => {
            messageIDs.push(v.messageID);
            // messageIDsObject[v.messageID] = true;

            return null;
        })

        // if(taptalkPinnedMessageIDHashmap[roomID]) {
        //     Object.assign(taptalkPinnedMessageIDHashmap[roomID], messageIDsObject)
        // }else {
        //     taptalkPinnedMessageIDHashmap[roomID] = messageIDsObject;
        // }
    
        // if(!taptalkPinnedMessageHashmap[roomID]) {
        //     taptalkPinnedMessageHashmap[roomID].pageNumber = 1;
        //     taptalkPinnedMessageHashmap[roomID].messages = [];
        //     taptalkPinnedMessageHashmap[roomID].totalItems = 1;
        //     taptalkPinnedMessageHashmap[roomID].totalPages = 1;

        //     taptalkPinnedMessageHashmap[roomID].messages = messages;

        //     callback.onSuccess(tataptalkPinnedMessageIDHashmap[roomID], ptalkPinnedMessageHashmap[roomID]);
        // }else {
        //     taptalkPinnedMessageHashmap[roomID].messages = messages.concat(taptalkPinnedMessageHashmap[roomID].messages);

        //     let doOrderPinned = (new_arr) => {
        //         taptalkPinnedMessageHashmap[roomID].messages = new_arr;
        //         callback.onSuccess(taptalkPinnedMessageIDHashmap[roomID], taptalkPinnedMessageHashmap[roomID]);
        //     }

        //     this.taptalkHelper.orderArrayFromLargestToSmallest(taptalkPinnedMessageHashmap[roomID].messages, "created", "desc", doOrderPinned);
        // }
        
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
    
            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID, messageIDs: messageIDs})
                .then(function (response) {
                    if(response.error.code !== "") {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.pinMessage(roomID, messageIDs, callback);
                        });
                    }else {
                        callback.onSuccess(response.data);
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },
    
    unpinMessage : (roomID, messageIDs, isUnpinAll, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/unpin`;
        let _this = this;
        // let messageIDs = [];

        // if(!isUnpinAll) {
        //     messages.map(v => {
        //         messageIDs.push(v.messageID);
    
        //         return null;
        //     })
        // }else {

        // }
    
        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`; 
    
            // let actionRemove = () => {
            //     messageIDs.map(v => {
            //         let indexMes = taptalkPinnedMessageHashmap[roomID].messages.findIndex(val => val.messageID === v);

            //         delete taptalkPinnedMessageIDHashmap[roomID][v];
                    
            //         if(indexMes !== -1) {
            //             taptalkPinnedMessageHashmap[roomID].messages.splice(indexMes, 1);
            //         }
            //     })
            // }
    
            // if(taptalkPinnedMessageHashmap[roomID]) {
            //     if(!isUnpinAll) {
            //         actionRemove();
            //     }else {
            //         delete taptalkPinnedMessageHashmap[roomID];
            //         delete taptalkPinnedMessageIDHashmap[roomID];
            //     }
            // }

            if(isUnpinAll) {
                taptalkPinnedMessageHashmap[roomID] = {
                    hasMore: false,
                    messages: [],
                    totalItems: 0,
                    totalPages: 1
                };

                taptalkPinnedMessageIDHashmap[roomID] = {};
            }
            
            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: roomID, messageIDs})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, null, () => {
                            _this.tapCoreMessageManager.unpinMessage(roomID, messageIDs, callback);
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getPinMessageIndexOnTaptalkPinnedMessageIDHashmap: (roomID, messageID) => {
        let idx = -1;

        if(taptalkPinnedMessageIDHashmap[roomID]) {
            idx = Object.keys(taptalkPinnedMessageIDHashmap[roomID]).findIndex(v => v === messageID);
        }

        return idx; 
    },

    hideMessageInRoom: (roomID, localID) => {
        if(this.taptalk.isAuthenticated()) {
            tapTalkRooms[roomID].messages[localID].isHidden = true;
            
            // console.log(tapTalkRooms[roomID].messages);
            for(let key in tapTalkRooms[roomID].messages) {
                if(!tapTalkRooms[roomID].messages[key].isHidden) {
                    return {
                        message: tapTalkRooms[roomID].messages[localID],
                        lastMessage: tapTalkRooms[roomID].messages[key]
                    }
                }
            }
        }
    },

    searchLocalRoomMessageWithKeyword: (keyword, roomID, callback) => {
        if(window.Worker) {
            var searchLocalRoomMessageWithKeywordWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                let {rooms, roomID, keyword, isClose} = e.data;
                let _resultMessages = [];
                
                if(!isClose) {
                    if(!rooms[roomID]) {
                        self.postMessage({
                            result: {
                                messages: [],
                                error: "Room not found"
                            }
                        })
                    } else {
                        Object.keys(rooms[roomID].messages).map(valMes => {
                            if(rooms[roomID].messages[valMes].body !== null && rooms[roomID].messages[valMes].body.toLowerCase().includes(keyword)) {
                                _resultMessages.push(rooms[roomID].messages[valMes])
                            }
            
                            return null;
                        })
                
                        self.postMessage({
                            result: {
                                messages: _resultMessages,
                                error: ""
                            }
                        })
                    }
                }else {
                    self.close();
                }
            }));

            searchLocalRoomMessageWithKeywordWorker.postMessage({
                rooms: tapTalkRooms,
                roomID: roomID,
                keyword: keyword
            });

            searchLocalRoomMessageWithKeywordWorker.addEventListener('message', (e) => {
                let { result } = e.data;
                
                if(result.error === "") {
                    callback.onSuccess({
                        keyword: keyword,
                        roomID: roomID,
                        messages: result.messages
                    })
                }else {
                    callback.onError(result.error);
                }

                searchLocalRoomMessageWithKeywordWorker.postMessage({isClose: true});
            });
        }else {
            callback.onError("Worker is not supported");
        }
    },

    searchLocalMessageWithKeyword: (keyword, callback) => {
        if(window.Worker) {
            var searchLocalMessageWithKeywordWorker = new WebWorker(() => self.addEventListener('message', function(e) {
                let {rooms, keyword, isClose} = e.data;
                let _resultMessages = [];

                if(!isClose) {
                    Object.keys(rooms).map(val => {
                        Object.keys(rooms[val].messages).map(valMes => {
                            if(rooms[val].messages[valMes].body !== null && rooms[val].messages[valMes].body.toLowerCase().includes(keyword)) {
                                _resultMessages.push(rooms[val].messages[valMes])
                            }
            
                            return null;
                        })
                    
                        return null;
                    })

                    self.postMessage({
                        result: {
                            messages: _resultMessages
                        }
                    })
                }else {
                    self.close();
                }
            }));
    
            searchLocalMessageWithKeywordWorker.postMessage({
                rooms: tapTalkRooms,
                keyword: keyword
            });

            searchLocalMessageWithKeywordWorker.addEventListener('message', (e) => {
                let { result } = e.data;
                
                callback.onSuccess({
                    messages: result.messages
                })

                searchLocalMessageWithKeywordWorker.postMessage({isClose: true});
            });
        }else {
            callback.onError("Worker is not supported");
        }
    }
}

//queue upload file
class TapUploadQueue {
    constructor() {
        this.queue = [];
        this.isRunning = false;
        this.callback = null;
    }
    
    setCallback(callback) {
        if (typeof(callback) !== "function") {
            throw new Error("callback must be function");
        }
        this.callback = callback;
    }
    
    addToQueue(localID, data, callback) {
        let generateNewUploadObject = () => {
            let item = {};
            item[localID] = {};
            item[localID].data = data;
            item[localID].callback = callback;
            return item;
        } 
        this.queue.push(generateNewUploadObject());

        if (!this.isRunning) {
            this.isRunning = true;
            this.processNext();
        }
    }
    
    processNext(stopIfEmpty) {
        if (this.queue.length != 0) {
            this.callback(this.queue.shift());
        } else if (!stopIfEmpty) {
            setTimeout(() => {
                this.processNext();
            }, 100);
        } else {
            this.isRunning = false;
        }
    }
}

var tapUplQueue = new TapUploadQueue();

tapUplQueue.setCallback((item) => {
    let _item = item[Object.keys(item)]
    this.tapCoreMessageManager.uploadChatFile(_item.data, _item.callback);
});
//queue upload file

exports.tapCoreContactManager  = {
    getAllUserContacts : (callback) => {
        let url = `${baseApiUrl}/v1/client/contact/list`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    if(response.error.code === "") {
                        taptalkContact = response.data.contacts;
                        callback.onSuccess(taptalkContact);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.getAllUserContacts(callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getFilterUserContacts : (contactString, callback) => {
        let _contactString = contactString.toLowerCase();
		let contactSearchResult = [];
		setTimeout(function() {
			for(let i in taptalkContact) {
				if(taptalkContact[i].user.fullname.toLowerCase().includes(_contactString) || taptalkContact[i].user.username.toLowerCase().includes(_contactString)) {
					contactSearchResult.push(taptalkContact[i])
				}
			}
            
            if(contactSearchResult.length > 0) {
				callback.onContactFound(contactSearchResult);
			}else {
				callback.onContactNotFound();
			}
		}, 300);
	},

    getUserDataWithUserID : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        // localStorage.setItem('TapTalk.UserData', encryptKey(JSON.stringify(userData), KEY_PASSWORD_ENCRYPTOR));

                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.getUserDataWithUserID(userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getUserDataWithXCUserID : (xcUserId, callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_xcuserid`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {xcUserID: xcUserId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.getUserDataWithXCUserID(xcUserId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    },

    addToTapTalkContactsWithUserID : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/add`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {userID: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.user);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.addToTapTalkContactsWithUserID(userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    addToTapTalkContactsWithPhoneNumber : (phoneNumber, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/add_by_phones`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {phones: phoneNumber})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data.users);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.addToTapTalkContactsWithPhoneNumber(phoneNumber, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    },

    getUserByUsername : (username, ignoreCase, callback) => {
		let url = `${baseApiUrl}/v1/client/user/get_by_username`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {username: username, ignoreCase: ignoreCase})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.getUserByUsername((username, ignoreCase, callback))
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
	},

    removeFromTapTalkContacts : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/remove`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {userID: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess('Removed from contacts successfully');
                    }else {
                        _this.taptalk.checkErrorResponse(response, callback, () => {
                            _this.tapCoreContactManager.removeFromTapTalkContacts(userId, callback)
                        });
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    
                });
        }
    }
}

//   //to encrypt and decrypt
var PKCS7Encoder = {};

PKCS7Encoder.decode = function(text) {
    var pad = text[text.length - 1];

    if (pad < 1 || pad > 16) {
        pad = 0;
    }

    return text.slice(0, text.length - pad);
};

PKCS7Encoder.encode = function(text) {
    var blockSize = 16;
    var textLength = text.length;
    var amountToPad = blockSize - (textLength % blockSize);

    var result = new Buffer(amountToPad);
    result.fill(amountToPad);

    return Buffer.concat([text, result]);
};

function encrypt(text, key) {
    var encoded = PKCS7Encoder.encode(new Buffer(text));
    key = crypto.createHash('sha256').update(key).digest();
    var iv = new Buffer(16);
    iv.fill(0);
    var cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    var cipheredMsg = Buffer.concat([cipher.update(encoded), cipher.final()]);
    return cipheredMsg.toString('base64');
};

function decrypt(text, key) {
    key = crypto.createHash('sha256').update(key).digest();
    var iv = new Buffer(16);
    iv.fill(0);
    var decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    var deciphered = Buffer.concat([decipher.update(text, 'base64'), decipher.final()]);
    deciphered = PKCS7Encoder.decode(deciphered);
    return deciphered.toString();
};
//   //to encrypt and decrypt

//   //Encryption Flow
//   // 1. Obtain message length, local ID length
//   // 2. Get local ID index (message length modulo by local ID length)
//   // 3. Generate random number from 1-9
//   // 4. Obtain salt character from local ID string with character position of local ID index
//   // 5. Insert salt character to encrypted message to the position index (index is calculated using this formula (((encrypted message length + random number) * random number) % encrypted message length)))
//   // 6. Add random number to the first index of the encrypted message with salt

  function encryptKey(text, localID) {
      if(text === null || localID === null) {
          return null; 
      }

      let substringLocalID = localID.substring(8, 8+16);
      let reverseSubstringLocalID = "";
      let appendedString = "";
      let charIndex = substringLocalID.length;
      
      while(charIndex > 0) {
          charIndex--;
          appendedString = null;
          appendedString =  substringLocalID.substring(charIndex, charIndex+1);
          reverseSubstringLocalID = reverseSubstringLocalID + appendedString;
      }

      //password is generated based on 16 first characters of KEY_PASSWORD_ENCRYPTOR + reversedSubstringLocalID
      let substringKeyPassword = KEY_PASSWORD_ENCRYPTOR.substring(0, 16);
      let password = substringKeyPassword + reverseSubstringLocalID;

      let stringLength = text.length;
      let localIDLength = localID.length;
      let localIDIndex = stringLength % localIDLength;

      let saltString = localID.substring(localIDIndex, localIDIndex+1);
      let encryptedString = encrypt(text, password);

      let randomNumber = Math.floor(Math.random() * 8) + 1;
      let encryptedStringLength = encryptedString.length;

      let saltCharIndexPosition = (((encryptedStringLength + randomNumber) * randomNumber) % encryptedStringLength);
      let encryptedStringWithSalt = encryptedString;

      let appendString = (str, index, value) => {
          return str.substr(0, index) + value + str.substr(index);
      }
      encryptedStringWithSalt = appendString(encryptedStringWithSalt, saltCharIndexPosition, saltString);
      encryptedStringWithSalt = appendString(encryptedStringWithSalt, 0, randomNumber.toString());

      return encryptedStringWithSalt;
  }

  function decryptKey(encryptedString, localID) {
      if(encryptedString === null || localID === null) {
          return null; 
      }

      let substringLocalID = localID.substring(8, 8+16);
      let reverseSubstringLocalID = "";
      let appendedString;
      let charIndex = substringLocalID.length;

      while(charIndex > 0) {
          charIndex--;
          appendedString = null;
          appendedString =  substringLocalID.substring(charIndex, charIndex+1);
          reverseSubstringLocalID = reverseSubstringLocalID + appendedString;
      }

      //password is generated based on 16 first characters of KEY_PASSWORD_ENCRYPTOR + reversedSubstringLocalID
      let substringKeyPassword = KEY_PASSWORD_ENCRYPTOR.substring(0, 16);
      let password = substringKeyPassword + reverseSubstringLocalID;
      
      let encryptedStringWithSalt = encryptedString;
      let encryptedStringLength = encryptedStringWithSalt.length - 2; //2 to remove random number & salt character

      let randomNumberString = encryptedStringWithSalt.substring(0, 1);
      let randomNumber = parseInt(randomNumberString);

      let saltCharIndexPosition = (((encryptedStringLength + randomNumber) * randomNumber) % encryptedStringLength);
      let encryptedStringModified = encryptedStringWithSalt.substr(1);

      if(saltCharIndexPosition < encryptedStringModified.length) {
          encryptedStringModified = encryptedStringModified.substring(0, saltCharIndexPosition) + '' + encryptedStringModified.substring(saltCharIndexPosition + 1);
      }else {
          return null;
      }

      let decryptedString = decrypt(encryptedStringModified, password);

      return decryptedString
  }