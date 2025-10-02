<template>
  <!-- 這個元件不渲染任何畫面，只負責監聽鍵盤事件 -->
  <div style="display:none;"></div>
</template>

<script>
// 使用 iView 的 Modal 來顯示彈窗
export default {
  name: 'ContestEscGuard',
  data () {
    return {
      // 簡單防抖：避免長按 ESC 連續跳多個視窗
      _escLocked: false,
      _unlockTimer: null
    }
  },
  methods: {
    _onKeydown (e) {
      // 只處理 Escape
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        if (this._escLocked) return
        this._escLocked = true
        this.$Modal.warning({
          title: '提示',
          content: '偵測到按下 ESC（測試功能）',
          okText: '確定',
          onOk: () => {},
          // 避免關閉回呼重複解鎖，改用計時器自動解鎖
        })
        // 300ms 後解鎖，防止連彈
        clearTimeout(this._unlockTimer)
        this._unlockTimer = setTimeout(() => {
          this._escLocked = false
        }, 300)
      }
    }
  },
  mounted () {
    // 掛上全域 keydown 監聽（只在這個元件掛載期間有效）
    window.addEventListener('keydown', this._onKeydown)
  },
  beforeDestroy () {
    window.removeEventListener('keydown', this._onKeydown)
    clearTimeout(this._unlockTimer)
  }
}
</script>
