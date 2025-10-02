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
    components: {},
    data () {
      return {
        CONTEST_STATUS: CONTEST_STATUS,
        route_name: '',
        btnLoading: false,
        contestID: '',
        contestPassword: '',
        columns: [
          {
            title: this.$i18n.t('m.StartAt'),
            render: (h, params) => {
              return h('span', time.utcToLocal(params.row.start_time))
            }
          },
          {
            title: this.$i18n.t('m.EndAt'),
            render: (h, params) => {
              return h('span', time.utcToLocal(params.row.end_time))
            }
          },
          {
            title: this.$i18n.t('m.ContestType'),
            render: (h, params) => {
              return h('span', this.$i18n.t('m.' + params.row.contest_type ? params.row.contest_type.replace(' ', '_') : ''))
            }
          },
          {
            title: this.$i18n.t('m.Rule'),
            render: (h, params) => {
              return h('span', this.$i18n.t('m.' + params.row.rule_type))
            }
          },
          {
            title: this.$i18n.t('m.Creator'),
            render: (h, data) => {
              return h('span', data.row.created_by.username)
            }
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
      //★ 新增：監聽 ESC
   
      // ...原本的初始化...
      window.addEventListener('keydown', this.handleHotkeys, true) // 第三參數 true = capture 提高攔截機會


      // ★ 第一次進到比賽詳情頁就提示全螢幕
      this.promptEnterFullscreen()

      // ★ 監聽全螢幕狀態變化
      document.addEventListener('fullscreenchange', this.onFullscreenChange)
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange)
      document.addEventListener('mozfullscreenchange', this.onFullscreenChange)
      document.addEventListener('MSFullscreenChange', this.onFullscreenChange)

      // ★ 額外：若彈窗被關閉沒點、使用者任意點擊頁面也嘗試一次（一次性）
      const oneShot = () => {
        if (!this.isFullscreen()) {
          this.requestFullscreen().catch(() => {})
        }
        document.removeEventListener('click', oneShot)
        document.removeEventListener('keydown', oneShot)
      }
      document.addEventListener('click', oneShot, { once: true })
      document.addEventListener('keydown', oneShot, { once: true })
    },
    methods: {
      ...mapActions(['changeDomTitle']),
      handleRoute (route) {
        this.$router.push(route)
      },
      checkPassword () {
        if (this.contestPassword === '') {
          this.$error('Password can\'t be empty')
          return
        }
        this.btnLoading = true
        api.checkContestPassword(this.contestID, this.contestPassword).then((res) => {
          this.$success('Succeeded')
          this.$store.commit(types.CONTEST_ACCESS, {access: true})
          this.btnLoading = false
        }, (res) => {
          this.btnLoading = false
        })
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
            return this.requestFullscreen().catch(() => {
              this.$Message.error('瀏覽器禁止自動全螢幕，請按 F11 或手動允許')
            })
          }
        })
      },
      onFullscreenChange () {
        // 離開全螢幕時再次提示（你也可以改成僅提醒不再彈）
        if (!this.isFullscreen()) {
          this.$Notice.warning({
            title: '已離開全螢幕',
            desc: '建議回到全螢幕以免分心。'
          })
          // 再提示一次是否要回到全螢幕
          this.promptEnterFullscreen()
        }
      },
      // ---- 覆蓋你原本的 ESC 行為：同時提示 + 可再進全螢幕 ----
      handleHotkeys (e) {
        // 除錯用：看 Key 與 KeyCode（打開 F12 Console 會看到）
        console.log('[hotkey]', { key: e.key, keyCode: e.keyCode, ctrl: e.ctrlKey, shift: e.shiftKey })

        // A) 偵測 ESC（27）
        if (e.key === 'Escape' || e.keyCode === 27) {
          this.$Modal.warning({
            title: '提示',
            content: '偵測到按下 ESC！',
            okText: '回到全螢幕',
            closable: false,
            maskClosable: false,
            onOk: () => {
              if (!this.isFullscreen()) {
                this.requestFullscreen().catch(() => {
                  this.$Message.info('若被瀏覽器阻擋，請按 F11 或允許全螢幕')
                })
              }
            }
          })
        }

        // B) 偵測 F12（123）或常見開發者工具快捷鍵（Ctrl+Shift+I/J、Ctrl+U）
        const isDevTools =
          e.keyCode === 123 ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
          (e.ctrlKey && (e.key === 'U' || e.key === 'u'))

        if (isDevTools) {
          // 注意：瀏覽器不保證能阻止開啟 DevTools，但我們可給警告並嘗試攔截預設行為
          if (e.preventDefault) e.preventDefault()
          if (e.stopPropagation) e.stopPropagation()

          this.$Modal.warning({
            title: '注意',
            content: '偵測到嘗試開啟開發者工具（F12 / Ctrl+Shift+I/J / Ctrl+U）。考試中請勿操作。',
            okText: '我知道了',
            closable: false,
            maskClosable: false
          })
        }
      }
    },
    
    computed: {
      ...mapState({
        showMenu: state => state.contest.itemVisible.menu,
        contest: state => state.contest.contest,
        contest_table: state => [state.contest.contest],
        now: state => state.contest.now
      }),
      ...mapGetters(
        ['contestMenuDisabled', 'contestRuleType', 'contestStatus', 'countdown', 'isContestAdmin',
          'OIContestRealTimePermission', 'passwordFormVisible']
      ),
      countdownColor () {
        if (this.contestStatus) {
          return CONTEST_STATUS_REVERSE[this.contestStatus].color
        }
      },
      showAdminHelper () {
        return this.isContestAdmin && this.contestRuleType === 'ACM'
      }
    },
    watch: {
      '$route' (newVal) {
        this.route_name = newVal.name
        this.contestID = newVal.params.contestID
        this.changeDomTitle({title: this.contest.title})
      }
    },
    beforeDestroy () {
      clearInterval(this.timer)
      this.$store.commit(types.CLEAR_CONTEST)
      window.addEventListener('keydown', this.handleHotkeys, true) // 第三參數 true = capture 提高攔截機會

      document.removeEventListener('fullscreenchange', this.onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange)
      document.removeEventListener('mozfullscreenchange', this.onFullscreenChange)
      document.removeEventListener('MSFullscreenChange', this.onFullscreenChange)
    }
  }
</script>

<style scoped lang="less">
  pre {
    display: inline-block;
  }

  #countdown {
    font-size: 16px;
  }

  .flex-container {
    #contest-main {
      flex: 1 1;
      width: 0;
      #contest-desc {
        flex: auto;
      }
    }
    #contest-menu {
      flex: none;
      width: 210px;
      margin-left: 20px;
    }
    .contest-password {
      margin-top: 20px;
      margin-bottom: -10px;
      &-input {
        width: 200px;
        margin-right: 10px;
      }
    }
  }
</style>
