package app.menchat.nativeapp

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider

class NativeActivity : ComponentActivity() {
    private lateinit var model: MainModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        model = ViewModelProvider(this)[MainModel::class.java]
        setContent { MenChatNative(model) }
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        model.notification(
            intent.getStringExtra("thread"),
            intent.getBooleanExtra("show_call", false) || intent.hasExtra("call"),
        )
        intent.removeExtra("thread")
        intent.removeExtra("call")
        intent.removeExtra("show_call")
    }

    override fun onStart() {
        super.onStart()
        if (::model.isInitialized) model.foreground = true
    }

    override fun onStop() {
        if (::model.isInitialized) model.onBackground()
        super.onStop()
    }
}
