package app.menchat.nativeapp

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
