// frontend/src/utils/antiCheat.js
// 比賽防作弊：自動全螢幕、離開全螢幕/切分頁/特殊按鍵彈最高優先級警告
let overlay = null
let locked = false

function showOverlay(reason) {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0,0,0,0.92)'
    overlay.style.zIndex = '999999'
    overlay.style.display = 'flex'
    overlay.style.flexDirection = 'column'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.color = '#fff'
    overlay.innerHTML = `
      <div style="font-size:2rem;font-weight:bold;margin-bottom:1.5rem;">防作弊警告</div>
      <div style="margin-bottom:2rem;">${reason || '偵測到可疑操作，請回到全螢幕作答'}</div>
      <button id="ac-ok-btn" style="font-size:1.2rem;padding:0.5em 2em;border-radius:8px;">我知道了，回到考試</button>
    `
    document.body.appendChild(overlay)
    overlay.querySelector('#ac-ok-btn').onclick = async () => {
      overlay.style.display = 'none'
      await requestFullscreen()
      locked = false
    }
  } else {
    overlay.style.display = 'flex'
    overlay.children[1].textContent = reason || '偵測到可疑操作，請回到全螢幕作答'
  }
  locked = true
}

function requestFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement && el.requestFullscreen) {
    return el.requestFullscreen()
  }
  return Promise.resolve()
}

function handleCheat(reason) {
  if (!locked) showOverlay(reason)
}

function onKeydown(e) {
  // F11, F12, Esc, Win(91/92)
  if (["F11", "F12", "Escape"].includes(e.key) || e.keyCode === 91 || e.keyCode === 92) {
    e.preventDefault()
    e.stopPropagation()
    handleCheat('偵測到可疑按鍵（F11/F12/Esc/Win）')
  }
}

export function installAntiCheat() {
  requestFullscreen()
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) handleCheat('偵測到退出全螢幕')
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleCheat('偵測到切換分頁/視窗')
  })
  window.addEventListener('blur', () => handleCheat('偵測到切換應用程式/最小化'))
  document.addEventListener('keydown', onKeydown, true)
}
