/* 15-02-2021 17:00  v1.9.7*/

var define, CryptoJS;
var crypto = require('crypto');
var md5 = require('./lib/md5');
var tapTalkRooms = {}; //room list with array of messages
var tapTalkRoomListHashmap = {}; //room list last message
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
let isFirstConnectedToWebSocket = false;

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
            for(var i in tapTalkRooms[message.room.roomID].messages) {
                tapTalkRooms[message.room.roomID].messages[i].isRead = true;
            }
        }
    
        module.exports.tapCoreRoomListManager.setRoomListLastMessage(message, 'update emit');
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

exports.taptalk = {
    forTesting : () => {
        let data = {
            // _tapTalkEmitMessageQueue: tapTalkEmitMessageQueue,
            _taptalkRooms: tapTalkRooms,
            _tapTalkRoomListHashmap: tapTalkRoomListHashmap,
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
						
						_this.taptalk.refreshActiveUser(function(response, error) {
							if(response) {
								callback("Upload success", null)
							}else {
								callback(null, "Failed refreshing active user")
							}
						})
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
			if(tapTalkRoomListHashmap[message.room.roomID]) {
				let count = tapTalkRoomListHashmap[message.room.roomID].unreadCount;

				if(!message.isRead) {
					if((user !== message.user.userID)) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = count + 1; 

                            tapTalkRoomListHashmap[message.room.roomID].unreadCount = count;
                        }
					}
				}else {
					if(count !== 0) {
                        if(!tapTalkRooms[message.room.roomID][message.localID]) {
                            count = 0;
                            tapTalkRoomListHashmap[message.room.roomID].unreadCount = count;
                        }
					}
                }
			}
		}

		if(!message.isHidden) {
			//first load roomlist
			if(action === null) {
				if(!tapTalkRoomListHashmap[message.room.roomID]) { //if room list not exist
					data.lastMessage = message;
					data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;
	
					tapTalkRoomListHashmap[message.room.roomID] = data;
				}else { //if room list exist
					if(tapTalkRoomListHashmap[message.room.roomID].lastMessage.created < message.created) {
						data.lastMessage = message;
	
						tapTalkRoomListHashmap[message.room.roomID].lastMessage = data.lastMessage;
					}

					unreadCounter();
				}
			}
			//first load roomlist

            //new emit action
			if(action === 'new emit') {
				if(!tapTalkRoomListHashmap[message.room.roomID]) {
                    data.lastMessage = message;
					data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;

					tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmap);
				}else {
					unreadCounter();
                    let temporaryRoomList = tapTalkRoomListHashmap[message.room.roomID];
                    
                    if((temporaryRoomList.lastMessage.created !== message.created)) {
						temporaryRoomList.lastMessage = message;
					}
	
					delete tapTalkRoomListHashmap[message.room.roomID];
	
					tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : temporaryRoomList}, tapTalkRoomListHashmap);
				}
			}
			//new emit action

			//update emit action
			if(action === 'update emit') {
                if(!tapTalkRoomListHashmap[message.room.roomID]) {
                    data.lastMessage = message;
					data.unreadCount = (!message.isRead && user !== message.user.userID) ? 1 : 0;

					tapTalkRoomListHashmap = Object.assign({[message.room.roomID] : data}, tapTalkRoomListHashmap);
				}else {
                    if((tapTalkRoomListHashmap[message.room.roomID].lastMessage.localID === message.localID)) {
                        tapTalkRoomListHashmap[message.room.roomID].lastMessage = message;
                    }else {
                        if(tapTalkRoomListHashmap[message.room.roomID].lastMessage.created < message.created) {
                            tapTalkRoomListHashmap[message.room.roomID].lastMessage = message;
                        }
                    }
                    
                    if(message.isRead) {
                        unreadCounter();
                    }
                }
			}
            //update emit action
		}
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

                            callback.onSuccess(tapTalkRoomListHashmap);
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
				callback.onSuccess(tapTalkRoomListHashmap);
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
							
							callback.onSuccess(tapTalkRoomListHashmap);
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
	}  
}

// const USER = this.taptalk.getTaptalkActiveUser();  

exports.tapCoreChatRoomManager = {
    sendStartTypingEmit : (roomID) => {
        let emitData = {
            eventName: SOCKET_START_TYPING,
            data: {
                roomID: roomID,
                user: this.taptalk.getTaptalkActiveUser()
            }
        };

        webSocket.send(JSON.stringify(emitData));
    },

    sendStopTypingEmit : (roomID) => {
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

    getGroupChatRoom : (groupId, callback) => {
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
	}	
}

exports.tapCoreMessageManager  = {
    constructTapTalkMessageModel : (messageBody, room, messageType, messageData, localID = null) => {
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
            if(quotedMessage.type === CHAT_MESSAGE_TYPE_FILE) {
                _quoteTitle = quotedMessage.data.fileName.split(".")[0];
            }else {
                _quoteTitle = quotedMessage.user.fullname;
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
        if(quotedMessage && !quoteContent && !quoteTitle && !quoteImageUrl ) {
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

		tapTalkRoomListHashmap = Object.assign({[messageModel.room.roomID] : newRoomListHashmap}, tapTalkRoomListHashmap);
    },

    pushNewRoom: (messageModel) => {
        let user = this.taptalk.getTaptalkActiveUser().userID;
        
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

        if(tapTalkRooms[_message.room.roomID]) {
            if(tapTalkRoomListHashmap[_message.room.roomID]) {
                tapTalkRoomListHashmap[_message.room.roomID].lastMessage = _message;
                tapTalkRoomListHashmap = Object.assign({[_message.room.roomID]: tapTalkRoomListHashmap[_message.room.roomID]}, tapTalkRoomListHashmap);
            }else {
                this.tapCoreRoomListManager.setRoomListLastMessage(_message, "new emit")
            }

            tapTalkRooms[_message.room.roomID].messages = Object.assign({[_message.localID]: _message}, tapTalkRooms[_message.room.roomID].messages);
        }else {
            this.tapCoreMessageManager.pushNewRoom(_message);
        }
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

    sendTextMessageWithoutEmit : (messageBody, room, callback, quotedMessage = false) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "", quotedMessage)
                :
                this.tapCoreMessageManager.constructTapTalkMessageModel(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "")
            ;

            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = messageBody;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

            callback(_message);
        }
    },

    sendTextMessage : (messageBody, room, callback, quotedMessage = false) => {
        if(this.taptalk.isAuthenticated()) {
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "", quotedMessage)
                :
                this.tapCoreMessageManager.constructTapTalkMessageModel(messageBody, room, CHAT_MESSAGE_TYPE_TEXT, "")
            ;

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
            };
                    
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = messageBody;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);

            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
            
            callback(_message);
            
            tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
        }
    },

    sendLocationMessage : (latitude, longitude, address, room, callback, quotedMessage = false) => {
        if(this.taptalk.isAuthenticated()) {
            let bodyValueLocation = `📍 Location`; 
			let data =  {
                latitude: latitude,
                longitude: longitude,
                address: address			
            }
            
            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueLocation, room, CHAT_MESSAGE_TYPE_LOCATION, data, quotedMessage)
                :
                this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueLocation, room, CHAT_MESSAGE_TYPE_LOCATION, data)
            ;

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: _MESSAGE_MODEL
			};
			
			let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
			// tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
			
            _message.body = bodyValueLocation;
            _message.data = data;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }

            // this.tapCoreMessageManager.pushToTapTalkEmitMessageQueue(_message);
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
			
			callback(_message);

			tapEmitMsgQueue.pushEmitQueue(JSON.stringify(emitData));
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
        uploadData.append("fileType", ((fileType === "image" || fileType === "video") ? fileType : "file")); 

        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;
            doXMLHTTPRequestUpload('POST', authenticationHeader, url, uploadData, callback.onProgress)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback.onSuccess(response.data);

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

    actionSendImageMessage : (file, caption, room, callback, isSendEmit, quotedMessage) => {
        if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
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

            compressImageFile(file, 20, 20).then(function(resultThumbnail) {
				let thumbnailImage = resultThumbnail.src;
				
				compressImageFile(file, imageWidth, imageHeight).then(function(resultOriginal) {
                    let currentLocalID = guid();

                    let uploadData = {
                        file: resultOriginal.file,
                        caption: caption,
                        room: room.roomID
                    };

                    let data = {
                        fileName: file.name,
                        mediaType: file.type,
                        size: file.size,
                        fileID: "",
                        thumbnail: thumbnailImage.split(',')[1],
                        width: imageWidth,
                        height: imageHeight,
                        caption: caption
                    };

                    let _MESSAGE_MODEL = quotedMessage ? 
                        _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueImage, room, CHAT_MESSAGE_TYPE_IMAGE, data, quotedMessage, currentLocalID)
                        :
                        _this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueImage, room, CHAT_MESSAGE_TYPE_IMAGE, data, currentLocalID)
                    ;
                    
                    let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

                    _message.body = bodyValueImage;
                    _message.data = data;
                    _message.bytesUpload = 0;
                    _message.percentageUpload = 0;
                    
                    if(quotedMessage) {
                        _message.quote.content = quotedMessage.body;
                    }
                    
                    _this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

                    callback.onStart(_message);
                    
                    tapUplQueue.addToQueue(_message.localID, uploadData, {
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
                })
            })
        }
    },

    sendImageMessage : (file, caption, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendImageMessage(file, caption, room, callback, true, quotedMessage);
    },

    sendImageMessageWithoutEmit : (file, caption, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendImageMessage(file, caption, room, callback, false, quotedMessage);
    },

    actionSendVideoMessage : (file, caption, room, callback, isSendEmit, quotedMessage) => {
        if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
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
    
                let data = {
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

                let _MESSAGE_MODEL = quotedMessage ? 
                    _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValueVideo, room, CHAT_MESSAGE_TYPE_VIDEO, data, quotedMessage, currentLocalID)
                    :
                    _this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValueVideo, room, CHAT_MESSAGE_TYPE_VIDEO, data, currentLocalID)
                ;
                
                let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));
    
                _message.body = bodyValueVideo;
                _message.data = data;
                _message.bytesUpload = 0;
                _message.percentageUpload = 0;

                if(quotedMessage) {
                    _message.quote.content = quotedMessage.body;
                }
                
                _this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);
                
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
            })
        }
    },
    
    sendVideoMessage : (file, caption, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendVideoMessage(file, caption, room, callback, true, quotedMessage);
    },

    sendVideoMessageWithoutEmit : (file, caption, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendVideoMessage(file, caption, room, callback, false, quotedMessage);
    },

    actionSendFileMessage : (file, room, callback, isSendEmit, quotedMessage) => {
        if(file.size > projectConfigs.core.chatMediaMaxFileSize) {
			callback.onError('90302', "Maximum file size is "+bytesToSize(projectConfigs.core.chatMediaMaxFileSize));
		}else {
            let currentLocalID = guid();
            let bodyValue = `📎 ${file.name}`;

            let uploadData = {
                file: file,
                caption: "",
                room: room.roomID
            };

            let data = {
                fileName: file.name,
                mediaType: file.type,
                size: file.size,
                fileID: ""
            };

            let _MESSAGE_MODEL = quotedMessage ? 
                this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote(bodyValue, room, CHAT_MESSAGE_TYPE_FILE, data, quotedMessage, currentLocalID)
                :
                this.tapCoreMessageManager.constructTapTalkMessageModel(bodyValue, room, CHAT_MESSAGE_TYPE_FILE, data, currentLocalID)
            ;
            
            let _message = JSON.parse(JSON.stringify(_MESSAGE_MODEL));

            _message.body = bodyValue;
            _message.data = data;
            _message.bytesUpload = 0;
            _message.percentageUpload = 0;

            if(quotedMessage) {
                _message.quote.content = quotedMessage.body;
            }
            
            this.tapCoreMessageManager.pushNewMessageToRoomsAndChangeLastMessage(_message);

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
    },

    sendFileMessage : (file, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendFileMessage(file, room, callback, true, quotedMessage);
    },

    sendFileMessageWithoutEmit : (file, room, callback, quotedMessage = false) => {
        this.tapCoreMessageManager.actionSendFileMessage(file, room, callback, false, quotedMessage);
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
        let getMinCreatedTimestamp = 0;
        let objectKeyRoomListlength = 0;
        
        if(tapTalkRooms[roomID] && Object.keys(tapTalkRooms[roomID].messages).length > 0) {
            objectKeyRoomListlength = Object.keys(tapTalkRooms[roomID].messages).length;
            getMinCreatedTimestamp =  tapTalkRooms[roomID].messages[Object.keys(tapTalkRooms[roomID].messages)[0]].created;
            lastUpdateTimestamp = tapTalkRooms[roomID].lastUpdated === 0 ? tapTalkRooms[roomID].messages[Object.keys(tapTalkRooms[roomID].messages)[objectKeyRoomListlength - 1]].created : tapTalkRooms[roomID].lastUpdated;
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

    markMessageAsRead : (message) => {
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
                        }else {
							for(let i in messages) {
								let findIndex = tapTalkRooms[roomID].messages.findIndex(value => value.messageID === messages[i]);
								tapTalkRooms[roomID].messages[findIndex].isDeleted = true;
							}
						}
					})
					.catch(function (err) {
						console.error('there was an error!', err);
					});
			}
        }
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
		let contactSearchResult = [];
		setTimeout(function() {
			for(let i in taptalkContact) {
				if(taptalkContact[i].user.fullname.includes(contactString) || taptalkContact[i].user.username.includes(contactString)) {
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