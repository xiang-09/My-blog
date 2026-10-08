import DefaultTheme from 'vitepress/theme'
import './style.css'

export default {
  ...DefaultTheme,
  // 如需自定义布局或组件，在这里注册
  enhanceApp({ app }) {
    // app.component('OrbitLoader', OrbitLoader)
  }
}