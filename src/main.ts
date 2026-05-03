import { createApp } from "vue"
import { createPinia } from "pinia"
import App from "./App.vue"
import router from "./router"
import "./assets/index.css"

const app = createApp(App)

app.use(createPinia())
app.use(router)

if (new URLSearchParams(window.location.search).get("surface") === "tray") {
    void router.replace("/tray-menu")
}

app.mount("#app")
