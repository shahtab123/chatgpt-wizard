
import classes from './index.module.css';

// const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): T => {
//     let timeout: ReturnType<typeof setTimeout> | null = null;
//     return function(this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
//         const later = () => {
//             clearTimeout(timeout!);
//             func.apply(this, args);
//         };
//         clearTimeout(timeout!);
//         timeout = setTimeout(later, wait);
//         return timeout as any as ReturnType<T>;
//     } as T;
// }

interface SelectedEventInfoInterface {
    x: number
    y: number
}

class SelectedEvent extends Event {
    info: SelectedEventInfoInterface

    constructor(type: string, info: SelectedEventInfoInterface) {
        super(type)
        this.info = info
    }
}

let selectionEndTimeout: NodeJS.Timeout = null
let iconDiv: HTMLElement = null
let popupDiv: HTMLElement = null

const iconID = 'gh-chatgpt-wizard-icon'
const defaultID = 'gh-chatgpt-wizard-default'
const menuID = 'gh-chatgpt-wizard-menu'
const subMenuID = 'gh-chatgpt-wizard-submenu'
const subTranslate = 'gh-chatgpt-wizard-translate'
const subExplain = 'gh-chatgpt-wizard-explain'
const subSummarize = 'gh-chatgpt-wizard-summarize'
const subRewrite = 'gh-chatgpt-wizard-rewrite'
const subGrammar = 'gh-chatgpt-wizard-grammar'
const subAsk = 'gh-chatgpt-wizard-ask'
const textareaID = 'gh-chatgpt-wizard-textarea'
const popupID = 'gh-chatgpt-wizard-popup'
const boxChatID = 'gh-chatgpt-wizard-boxchat'
const boxAnswerID = 'gh-chatgpt-wizard-box-answer'
const answerID = 'gh-chatgpt-wizard-answer'
const copyID = 'gh-chatgpt-wizard-copy'
const typingID = 'gh-chatgpt-wizard-typing'
const contentWidth = 500
const contentAskWidth = 400

let port = null as chrome.runtime.Port
let currentPortName = null as string

export const getDataFromStorage = (): Promise<{ openaiKey: string; nativeLang?: string; settingPopup?: string, type?: string, model?: string }> => new Promise((resolve, reject) => {
    chrome.storage.local.get(['nativeLang', 'settingPopup', 'openaiKey', 'type', 'model'], result => {
        if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
        } else {
            resolve({
                openaiKey: result.openaiKey || '',
                model: result.model || 'gpt-3.5-turbo',
                nativeLang: result.nativeLang || 'en',
                settingPopup: result.settingPopup || 'display_icon',
                type: result.type || 'chatgpt-translate',
            })
        }
    })
})

const setResponseToPopup = (message: {success: boolean, token: string, id?: string}) => {
    if (popupDiv) {
        const divID = `${answerID}-${message?.id}`
        const iconCopy = chrome.runtime.getURL('icons/copy.svg')
        let answerDiv = document.getElementById(divID);
        // remove typing first
        document.getElementById(typingID)?.remove();

        if (answerDiv) {
            answerDiv.textContent += message.token;
        } else {
            const div = document.createElement('div');
            div.innerHTML = `<div title="Click to copy!" id="${boxAnswerID}" class="${classes.answer}">
                <div title="Click to copy!" id="${divID}" class="${classes.answerDetail}">${message.token}</div>
                <div class=${classes.copy}>
                    <img style="width: 17px; height: 17px;" src=${iconCopy} />
                    <span id="${copyID}" style="font-size:12px;"></span>
                </div>
            </div>`;
            document.getElementById(boxChatID).appendChild(div);

            // add event onClick
            const boxAnswer = document.getElementById(boxAnswerID)
            if (boxAnswer) {
                boxAnswer.onclick = async () => {
                    try {
                        const text = document.getElementById(divID).innerText
                        await navigator.clipboard.writeText(text);
                        // show message copied!
                        const copied = document.getElementById(copyID)
                        if (copied) {
                            copied.style.display = 'block';
                            copied.innerText = 'Copied!';
                            setTimeout(() => {
                                copied.style.display = 'none';
                                copied.innerText = '';
                            }, 2000)
                        }

                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                      }
                }
            }
            
        }
    }
}

const removeIcon = () => {
    if (iconDiv) {
        document.body.removeChild(iconDiv)
        iconDiv = null
    }
}

const removePopup = () => {
    if (popupDiv) {
        document.body.removeChild(popupDiv)
        popupDiv = null
    }
}

const removeIconAndPopup = () => {
    removeIcon()
    removePopup()
}

const getPosition = (el: Range) => {
    const rect = el.getBoundingClientRect()
    return {
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX,
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        width: rect.width,
        height: rect.height,
    }
}

const removeChatHistory = (uuid: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(uuid, () => {
            // Check for errors in chrome.runtime.lastError
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            console.log('Uuid removed from storage');
            resolve();
        });
    });
}

const iconHtml = () => {
    const iconTranslate = chrome.runtime.getURL('icons/icon-translate.svg')
    const iconExplain = chrome.runtime.getURL('icons/icon-explain.svg')
    const iconSummarize = chrome.runtime.getURL('icons/icon-summarize.svg')
    const iconEdit = chrome.runtime.getURL('icons/icon-edit.svg')
    const iconGrammar = chrome.runtime.getURL('icons/icon-grammar.svg')
    const iconAsk = chrome.runtime.getURL('icons/icon-ask.svg')

    const icon64URL = chrome.runtime.getURL('icons/icon-64.png')

    return `<img id="${defaultID}" class="${classes.icon}" atl="ChatGPT Extension" src="${icon64URL}" />
    <div id="${menuID}" class="${classes.menu}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 4L6 9L11 4H1Z" fill="#12a37f"></path>
        </svg>
        <div id="${subMenuID}" class="${classes.menuBox}">
            <span class="${classes.menuTitle}">Quick features</span>
            <div id="${subTranslate}" class="${classes.menuItem}">
                <div class="${classes.iconItem}">
                    <img style="width: 15px; height: 15px; margin: 0;" alt="Translate" src="${iconTranslate}"></img>
                    <span style="padding-left: 8px; color: #000;font-size: 14px;">Translate</span>
                </div>
            </div>
            <div id="${subExplain}" class="${classes.menuItem}">
                <div class="${classes.iconItem}">
                    <img style="width: 15px; height: 15px;  margin: 0;" alt="Explain" src="${iconExplain}"></img>
                    <span style="padding-left: 8px; color: #000;font-size: 14px;">Explain</span>
                </div>
            </div>
            <div id="${subSummarize}" class="${classes.menuItem}">
                <div class="${classes.iconItem}">
                    <img style="width: 15px; height: 15px;  margin: 0;" alt="Summarize" src="${iconSummarize}"></img>
                    <span style="padding-left: 8px; color: #000;font-size: 14px;">Summarize</span>
                </div>
            </div>
            <div id="${subRewrite}" class="${classes.menuItem}">
                <div class="${classes.iconItem}">
                    <img style="width: 15px; height: 15px;  margin: 0;" alt="Rewrite" src="${iconEdit}"></img>
                    <span style="padding-left: 8px; color: #000;font-size: 14px;">Rewrite</span>
                </div>
            </div>
            <div id="${subGrammar}" class="${classes.menuItem}">
                <div class="${classes.iconItem}">
                    <img style="width: 15px; height: 15px;  margin: 0;" alt="Grammar correction" src="${iconGrammar}"></img>
                    <span style="padding-left: 8px; color: #000;font-size: 14px;">Grammar</span>
                </div>
            </div>
            
        </div>
    </div>`

//     <div id="${subAsk}" class="${classes.menuItem}">
//     <div class="${classes.iconItem}">
//         <img style="width: 15px; height: 15px;  margin: 0;" alt="Ask ChatGPT" src="${iconAsk}"></img>
//         <span style="padding-left: 8px; color: #000;font-size: 14px;">Ask ChatGPT</span>
//     </div>
// </div>
}

const htmlPopup = (text: string, type: string) => {
    let title  = 'Translate'
    if (type === 'chatgpt-explain') {
        title = 'Explain'
    } else if (type === 'chatgpt-summarize') {
        title = 'Summarize'
    } else if (type === 'chatgpt-rewrite') {
        title = 'Rewrite'
    } else if (type === 'chatgpt-grammar') {
        title = 'Grammar correction'
    }
    const icon64URL = chrome.runtime.getURL('icons/icon-64.png')
    return `<div class="${classes.popup}">
            <div class="${classes.popupHead}" style="cursor: move;" title="Drag me!">
                <div style="display: flex;align-items: center;">
                    <image style="width: 32px; height: 32px; margin: 0;" src="${icon64URL}" alt=${title} />
                    <p class="${classes.popupTitle}">${title}</p>
                </div>
            </div>
            <div id="${boxChatID}" class="${classes.boxChat}">
                <div  class="${classes.question}">
                    <div class="${classes.questionDetail}">${text.trim()}</div>
                </div>

                <div id="${typingID}" class="${classes.answer}">
                    <div style="white-space: nowrap" class="${classes.answerDetail}">
                        <div class="${classes.typing}">
                            <div class="${classes.typing_dot}"></div>
                            <div class="${classes.typing_dot}"></div>
                            <div class="${classes.typing_dot}"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="${classes.popupFooter}"> 
                Powered by ChatGPT Wizard
            </div>
        </div>`
}

const htmlAskPopup = (text: string) => {

    const icon64URL = chrome.runtime.getURL('icons/icon-64.png')
    return `<div class="${classes.popup}">
                <div class="${classes.popupHead}">
                    <div style="display: flex;align-items: center;">
                        <image style="width: 32px; height: 32px; margin: 0;" src="${icon64URL}" alt=${`Ask ChatGPT`} />
                        <p class="${classes.popupTitle}">Ask ChatGPT</p>
                    </div>
                </div>
                <div class="${classes.boxChatAsk}">
                    <div id="${boxChatID}"></div>
                    <div class="${classes.popupFooter}">
                        <div class="${classes.popupInput}">
                            <textarea id="${textareaID}" rows="1" class="${classes.questionInput}" placeholder="Ask ChatGPT">${text + `\\n`}</textarea>
                            <div class="${classes.btnSend}">
                                <svg
                                    style="width: 24px; height: 24px;"
                                    xmlns='http://www.w3.org/2000/svg'
                                    className='h-5 w-5 transform rotate-45'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='#01539d' // change color at here
                                    strokeWidth='2'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    >
                                    <line x1='22' y1='2' x2='11' y2='13' />
                                    <polygon points='22 2 15 22 11 13 2 9 22 2' />
                                </svg>
                            </div>
                        </div>
                        <p style="margin-top: 5px;"> Powered by ChatGPT Wizard</p>   
                    </div>

                </div>
                
            </div>`
}

const getPopupPosition = (selectedTextRect: DOMRect) => {
    const viewportWidth = window.innerWidth;
    // Calculate the available space to the left and right of the selected text
    const availableSpaceRight = viewportWidth - (window.scrollX + selectedTextRect.right + contentWidth);
    const availableSpaceLeft = selectedTextRect.left - (window.scrollX + contentWidth);

     // Set position center
    let left = selectedTextRect.left - window.scrollX + (selectedTextRect.width / 2) - (contentWidth / 2);
    
    if (availableSpaceRight > 0 && availableSpaceRight > availableSpaceLeft) {
        left = (selectedTextRect.right - selectedTextRect.width / 2) - window.scrollX;
    } else if (availableSpaceLeft > 0 && availableSpaceRight < availableSpaceLeft) {
        left = selectedTextRect.left - window.scrollX - contentWidth + selectedTextRect.width / 2;
    }

    return {
        top: selectedTextRect.bottom + window.scrollY,
        left: left,
    }
}

const initPopup = async (text: string, selectedTextRect: DOMRect, type = 'chatgpt-translate') => {
    const position = getPopupPosition(selectedTextRect)

    // Create the popupDiv and set its styles
    popupDiv = document.createElement('div');
   
    popupDiv.style.backgroundColor = 'white';
    popupDiv.style.padding = '10px';
    popupDiv.style.zIndex = '2147483647';
    popupDiv.style.color = 'black';
    popupDiv.style.border = 'solid transparent';
    popupDiv.style.borderRadius = '8px';
    popupDiv.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)';
    popupDiv.style.transition = 'left 0.1s, top 0.1s';
    popupDiv.id = popupID;
    if (type === 'chatgpt-ask') {
        popupDiv.style.position = 'fixed';
        popupDiv.style.top = '0'
        popupDiv.style.right = '0'
        popupDiv.style.height = '100%'
        popupDiv.style.borderTopRightRadius = '0'
        popupDiv.style.borderBottomRightRadius = '0'
        popupDiv.style.width = `${contentAskWidth}px`;
        popupDiv.innerHTML = htmlAskPopup(text);

        // TODO
        // event handle Input
        const inputEl = document.getElementById(textareaID)
        if (inputEl) {
            inputEl.onkeydown = (e: KeyboardEvent) => {
                const target = e.target as HTMLTextAreaElement;
                if (target.value.includes('\n') || target.value.includes('\r\n')) {
                    console.log("A new line was added or is present!");
                    // You can add any other logic you need here
                  }
            }
        }          
    } else {
        popupDiv.style.position = 'absolute';
        popupDiv.draggable = true;
        popupDiv.style.left = `${position.left}px`;
        popupDiv.style.top = `${position.top}px`;
        popupDiv.style.width = `${contentWidth}px`;
        popupDiv.innerHTML = htmlPopup(text, type);
    }
   
    document.body.appendChild(popupDiv);

    // add draggable
    if (type !== 'chatgpt-ask') {
        const draggable = document.getElementById(popupID)
        let isDragging = false;
        let offsetX: number, offsetY: number;
    
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const x = e.clientX - offsetX + window.scrollX;
            const y = e.clientY - offsetY + window.scrollY;
        
            draggable.style.left = `${x}px`;
            draggable.style.top = `${y}px`;
        }
        const onMouseUp = () => {
            isDragging = false;
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        draggable.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            offsetX = e.clientX - draggable.getBoundingClientRect().left;
            offsetY = e.clientY - draggable.getBoundingClientRect().top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
}

const chatGPT = async (text: string, type = 'chatgpt-translate') => {
    const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    currentPortName = `content-script-${uuid}`
    port = chrome.runtime.connect({
        name: currentPortName,
    })
    // save to local
    // await chrome.storage.local.set({uuid: [text]})
    // send to background
    port.postMessage({text, uuid, type})
    port.onMessage.addListener(async (data: any) => {
        if (data.action === 'chatGPTResponse' && data.portName === currentPortName) {
            setResponseToPopup(data.message)
        }
    })
}

document.addEventListener('selectionEnd', async () => {
    const {openaiKey, settingPopup, type} = await getDataFromStorage()
    if (!openaiKey) return

    if (settingPopup === 'hide') return

    const selection =document.getSelection();
    const selectionRect = selection.getRangeAt(0).getBoundingClientRect()
    const selectionText = selection.toString();
    
    if (selectionText.length > 1) {
        if (settingPopup === 'display_icon') {
            iconDiv = document.createElement('div')
            iconDiv.style.position = 'absolute'
            iconDiv.style.backgroundColor = 'transparent'
            iconDiv.style.height = '30px'
            iconDiv.style.width = '60px'
            iconDiv.style.borderRadius = '8px'
            iconDiv.style.boxShadow = 'rgba(0, 0, 0, 0.2) 0px 4px 8px 0px, rgba(0, 0, 0, 0.19) 0px 6px 20px 0px'

            // Calculate the position for the icon button, considering page scroll
            const position = getPosition(selection.getRangeAt(0))
            const iconWidth = 60 // Width of the icon
            const left = position.left + window.scrollX + position.width / 2 - iconWidth / 2;

             // Add a small gap between the selection and the icon
            const spacing = 5;
            let top = position.bottom + spacing;

            iconDiv.style.left = `${left}px`
            iconDiv.style.top = `${top}px`
            iconDiv.style.zIndex = '2147483647'
            iconDiv.style.display = 'flex';
            iconDiv.style.alignContent = 'center';
            iconDiv.style.background = '#fff';
            iconDiv.style.padding = '2px';
            iconDiv.id = iconID
            iconDiv.innerHTML = iconHtml()
   
            // append to body
            document.body.appendChild(iconDiv)
            
            // add event click
            const defaultElement = document.getElementById(defaultID);
            if (defaultElement) {
                defaultElement.onclick = async () => {
                    await initPopup(selectionText, selectionRect, type)
                    chatGPT(selectionText, type)
                }
            }

            const menuElement = document.getElementById(menuID);
            if (menuElement) {
                menuElement.onclick = async (event: any) => {
                    event.stopPropagation();
                    const subMenu = document.getElementById(subMenuID)
                    if (subMenu) {
                        if (subMenu.offsetParent !== null) {
                            subMenu.style.display = 'none'
                        } else {
                            subMenu.style.display = 'flex'

                            // action
                            const translateEl = document.getElementById(subTranslate);
                            if (translateEl) {
                                translateEl.onclick = async () => {
                                    removeIcon()
                                    await initPopup(selectionText, selectionRect, 'chatgpt-translate')
                                    chatGPT(selectionText, 'chatgpt-translate')
                                }
                            }
                            const explainEl = document.getElementById(subExplain);
                            if (explainEl) {
                                explainEl.onclick = async () => {
                                    removeIcon()
                                    await initPopup(selectionText, selectionRect, 'chatgpt-explain')
                                    chatGPT(selectionText, 'chatgpt-explain')
                                }
                            }
                            const summarizeEl = document.getElementById(subSummarize);
                            if (summarizeEl) {
                                summarizeEl.onclick = async () => {
                                    removeIcon()
                                    await initPopup(selectionText, selectionRect, 'chatgpt-summarize')
                                    chatGPT(selectionText, 'chatgpt-summarize')
                                }
                            }
                            const rewriteEl = document.getElementById(subRewrite);
                            if (rewriteEl) {
                                rewriteEl.onclick = async () => {
                                    removeIcon()
                                    await initPopup(selectionText, selectionRect, 'chatgpt-rewrite')
                                    chatGPT(selectionText, 'chatgpt-rewrite')
                                }
                            }
                            const grammarEl = document.getElementById(subGrammar);
                            if (grammarEl) {
                                grammarEl.onclick = async () => {
                                    removeIcon()
                                    await initPopup(selectionText, selectionRect, 'chatgpt-grammar')
                                    chatGPT(selectionText, 'chatgpt-grammar')
                                }
                            }

                            // const askEl = document.getElementById(subAsk);
                            // if (askEl) {
                            //     askEl.onclick = async () => {
                            //         removeIcon()
                            //         await initPopup(selectionText, selectionRect, 'chatgpt-ask')
                            //         // chatGPT(selectionText, 'chatgpt-ask')
                            //     }
                            // }

                        }
                    }
                }
            }
           
        } else {
            await initPopup(selectionText, selectionRect, type)
            chatGPT(selectionText, type)
        }
    }
})

document.addEventListener('click', (evt: MouseEvent) => {
    const clickedElement = evt.target as Element;
    const { id } = clickedElement
    if (id === popupID || id === defaultID) removeIcon()
    else {
        if (!clickedElement.closest(`#${popupID}`)) {
            removeIconAndPopup()  
        } else {
            removeIcon()
        }
    }
})

// Right click
// document.addEventListener('contextmenu', () => {
//     removeIconAndPopup()  
// })

// debounce version of selection event
document.addEventListener('mouseup', (evt: MouseEvent) => {
    selectionEndTimeout = setTimeout(() => {
        const noContentWindow = !popupDiv
        const haveText = window.getSelection().toString() !== ''
        if (noContentWindow && haveText) {
            const coordinates = {
                x: evt.pageX - document.body.scrollLeft,
                y: evt.pageY - document.body.scrollTop,
            }
            const info = {
                ...coordinates,
            }
            const selectionEndEvent = new SelectedEvent('selectionEnd', info)
            document.dispatchEvent(selectionEndEvent)
        }
    }, 100)
})
document.addEventListener('selectionchange', () => {
    if (selectionEndTimeout) {
        clearTimeout(selectionEndTimeout)
    }
})
// end debounce version of selection event

// contextMenu
chrome.runtime.onMessage.addListener(async (data: any) => {
    removeIconAndPopup()
    const selection = document.getSelection();
    await initPopup(selection.toString(), selection.getRangeAt(0).getBoundingClientRect(), data.type)
    chatGPT(selection.toString(), data.type)
})
