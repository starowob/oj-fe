<template>
  <div class="flex-container">
    <div id="contest-main">
      <!--children-->
      <transition name="fadeInUp">
        <router-view></router-view>
      </transition>
      <!--children end-->
      <div class="flex-container" v-if="route_name === 'contest-details'">
        <template>
          <div id="contest-desc">
            <Panel :padding="20" shadow>
              <div slot="title">
                {{contest.title}}
              </div>
              <div slot="extra">
                <Tag type="dot" :color="countdownColor">
                  <span id="countdown">{{countdown}}</span>
                </Tag>
              </div>
              <div v-html="contest.description" class="markdown-body"></div>
              <div v-if="passwordFormVisible" class="contest-password">
                <Input v-model="contestPassword" type="password"
                       placeholder="contest password" class="contest-password-input"
                       @on-enter="checkPassword"/>
                <Button type="info" @click="checkPassword">Enter</Button>
              </div>
            </Panel>
            <Table :columns="columns" :data="contest_table" disabled-hover style="margin-bottom: 40px;"></Table>
          </div>
        </template>
      </div>
    </div>

    <div v-show="showMenu" id="contest-menu">
      <VerticalMenu @on-click="handleRoute">
        <VerticalMenu-item :route="{name: 'contest-details', params: {contestID: contestID}}">
          <Icon type="home"></Icon>
          {{$t('m.Overview')}}
        </VerticalMenu-item>
        <VerticalMenu-item :disabled="contestMenuDisabled"
                           :route="{name: 'contest-announcement-list', params: {contestID: contestID}}">
          <Icon type="chatbubble-working"></Icon>
          {{$t('m.Announcements')}}
        </VerticalMenu-item>
        <VerticalMenu-item :disabled="contestMenuDisabled"
                           :route="{name: 'contest-problem-list', params: {contestID: contestID}}">
          <Icon type="ios-photos"></Icon>
          {{$t('m.Problems')}}
        </VerticalMenu-item>
        <VerticalMenu-item v-if="OIContestRealTimePermission"
                           :disabled="contestMenuDisabled"
                           :route="{name: 'contest-submission-list'}">
          <Icon type="navicon-round"></Icon>
          {{$t('m.Submissions')}}
        </VerticalMenu-item>
        <VerticalMenu-item v-if="OIContestRealTimePermission"
                           :disabled="contestMenuDisabled"
                           :route="{name: 'contest-rank', params: {contestID: contestID}}">
          <Icon type="stats-bars"></Icon>
          {{$t('m.Rankings')}}
        </VerticalMenu-item>
        <VerticalMenu-item v-if="showAdminHelper"
                           :route="{name: 'acm-helper', params: {contestID: contestID}}">
          <Icon type="ios-paw"></Icon>
          {{$t('m.Admin_Helper')}}
        </VerticalMenu-item>
      </VerticalMenu>
    </div>
  </div>
</template>

<script>
  import moment from 'moment'
  import api from '@oj/api'
  import { mapState, mapGetters, mapActions } from 'vuex'
  import { types } from '@/store'
  import { CONTEST_STATUS_REVERSE, CONTEST_STATUS } from '@/utils/constants'
  import time from '@/utils/time'

  export default {
    name: 'ContestDetail',
    data () {
      return {
        CONTEST_STATUS: CONTEST_STATUS,
        route_name: '',
        btnLoading: false,
        contestID: '',
        contestPassword: '',

        // 違規計數
        violationCount: 0,
        // 抑制 flag，避免回到考試誤判
        _suppressGuardUntil: 0,

        columns: [
          {
            title: this.$i18n.t('m.StartAt'),
            render: (h, params) => h('span', time.utcToLocal(params.row.start_time))
          },
          {
            title: this.$i18n.t('m.EndAt'),
            render: (h, params) => h('span', time.utcToLocal(params.row.end_time))
          },
          {
            title: this.$i18n.t('m.ContestType'),
            render: (h, params) => h('span', this.$i18n.t('m.' + (params.row.contest_type ? params.row.contest_type.replace(' ', '_') : '')))
          },
          {
            title: this.$i18n.t('m.Rule'),
            render: (h, params) => h('span', this.$i18n.t('m.' + params.row.rule_type))
          },
          {
            title: this.$i18n.t('m.Creator'),
            render: (h, data) => h('span', data.row.created_by.username)
          }
        ]
      }
    },
    mounted () {
      this.contestID = this.$route.params.contestID
      this.route_name = this.$route.name
      this.$store.dispatch('getContest').then(res => {
        this.changeDomTitle({title: res.data.data.title})
        let data = res.data.data
        let endTime = moment(data.end_time)
        if (endTime.isAfter(moment(data.now))) {
          this.timer = setInterval(() => {
            this.$store.commit(types.NOW_ADD_1S)
          }, 1000)
        }
      })

      // 偵測鍵盤 (ESC, F12)
      window.addEventListener('keydown', this.handleHotkeys, true)

      // 進入時提示全螢幕
      this.promptEnterFullscreen()

      // 偵測全螢幕狀態
      document.addEventListener('fullscreenchange', this.onFullscreenChange)
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange)
      document.addEventListener('mozfullscreenchange', this.onFullscreenChange)
      document.addEventListener('MSFullscreenChange', this.onFullscreenChange)

      // 任意點擊或按鍵也嘗試一次
      const oneShot = () => {
        if (!this.isFullscreen()) this.requestFullscreen().catch(() => {})
        document.removeEventListener('click', oneShot)
        document.removeEventListener('keydown', oneShot)
      }
      document.addEventListener('click', oneShot, { once: true })
      document.addEventListener('keydown', oneShot, { once: true })

      // 偵測切換分頁/視窗
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
      window.addEventListener('blur', this.handleWindowBlur, true)
    },
    methods: {
      ...mapActions(['changeDomTitle']),
      handleRoute (route) { this.$router.push(route) },
      checkPassword () {
        if (this.contestPassword === '') {
          this.$error('Password can\'t be empty'); return
        }
        this.btnLoading = true
        api.checkContestPassword(this.contestID, this.contestPassword).then(() => {
          this.$success('Succeeded')
          this.$store.commit(types.CONTEST_ACCESS, {access: true})
          this.btnLoading = false
        }).catch(() => { this.btnLoading = false })
      },

      isFullscreen () {
        return document.fullscreenElement ||
               document.webkitFullscreenElement ||
               document.mozFullScreenElement ||
               document.msFullscreenElement
      },
      requestFullscreen (el = document.documentElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen
        if (req) return req.call(el)
        return Promise.reject(new Error('Fullscreen API not supported'))
      },
      exitFullscreen () {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen
        if (exit) return exit.call(document)
        return Promise.resolve()
      },
      promptEnterFullscreen () {
        if (this.isFullscreen()) return
        this.$Modal.confirm({
          title: '建議全螢幕作答',
          content: '為了專心作答，建議進入全螢幕模式。',
          okText: '進入全螢幕',
          cancelText: '稍後',
          closable: false,
          maskClosable: false,
          onOk: () => {
            this._suppress(300)
            return this.requestFullscreen().catch(() => {
              this.$Message.error('瀏覽器禁止自動全螢幕，請按 F11 或手動允許')
            })
          }
        })
      },
      onFullscreenChange () {
        if (this._isSuppressed()) return
        if (!this.isFullscreen()) this.addViolation('已離開全螢幕')
      },
      handleHotkeys (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          this.addViolation('按下 ESC 離開全螢幕')
        }
        const isDevTools =
          e.keyCode === 123 ||
          (e.ctrlKey && e.shiftKey && ['I','i','J','j'].includes(e.key)) ||
          (e.ctrlKey && ['U','u'].includes(e.key))
        if (isDevTools) {
          if (e.preventDefault) e.preventDefault()
          if (e.stopPropagation) e.stopPropagation()
          this.$Modal.warning({
            title: '注意',
            content: '偵測到嘗試開啟開發者工具。考試中請勿操作。',
            okText: '我知道了',
            closable: false,
            maskClosable: false
          })
        }
      },
      handleVisibilityChange () {
        if (this._isSuppressed()) return
        if (document.hidden) this.addViolation('切換到其他分頁')
      },
      handleWindowBlur () {
        if (this._isSuppressed()) return
        this.addViolation('切換到其他程式視窗')
      },

      // 統一違規處理
      addViolation (reason) {
        this.violationCount++
        const times = this.violationCount
        const title = times >= 3 ? '嚴重警告' : '警告'

        this.$Modal.warning({
          title,
          content: `違規行為：${reason}<br>累計次數：${times}`,
          okText: '回到考試',
          closable: false,
          maskClosable: false,
          onOk: () => {
            this._suppress(300) // 抑制 300ms 避免誤判
            if (!this.isFullscreen()) {
              this.requestFullscreen().catch(() => {
                this.$Message.info('若被瀏覽器阻擋，請按 F11 或允許全螢幕')
              })
            }
          }
        })
      },

      // 抑制機制
      _suppress (ms = 300) { this._suppressGuardUntil = Date.now() + ms },
      _isSuppressed () { return Date.now() < this._suppressGuardUntil }
    },
    computed: {
      ...mapState({
        showMenu: state => state.contest.itemVisible.menu,
        contest: state => state.contest.contest,
        contest_table: state => [state.contest.contest],
        now: state => state.contest.now
      }),
      ...mapGetters(['contestMenuDisabled','contestRuleType','contestStatus','countdown','isContestAdmin','OIContestRealTimePermission','passwordFormVisible']),
      countdownColor () {
        if (this.contestStatus) {
          return CONTEST_STATUS_REVERSE[this.contestStatus].color
        }
      },
      showAdminHelper () { return this.isContestAdmin && this.contestRuleType === 'ACM' }
    },
    beforeDestroy () {
      clearInterval(this.timer)
      this.$store.commit(types.CLEAR_CONTEST)
      window.removeEventListener('keydown', this.handleHotkeys, true)
      document.removeEventListener('fullscreenchange', this.onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange)
      document.removeEventListener('mozfullscreenchange', this.onFullscreenChange)
      document.removeEventListener('MSFullscreenChange', this.onFullscreenChange)
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
      window.removeEventListener('blur', this.handleWindowBlur, true)
    }
  }
</script>

<style scoped lang="less">
  pre { display: inline-block; }
  #countdown { font-size: 16px; }
  .flex-container {
    #contest-main {
      flex: 1 1;
      width: 0;
      #contest-desc { flex: auto; }
    }
    #contest-menu {
      flex: none;
      width: 210px;
      margin-left: 20px;
    }
    .contest-password {
      margin-top: 20px;
      margin-bottom: -10px;
      &-input { width: 200px; margin-right: 10px; }
    }
  }
</style>
