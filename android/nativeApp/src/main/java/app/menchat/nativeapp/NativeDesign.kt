package app.menchat.nativeapp

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class ChatPalette(
    val canvas: Color,
    val panel: Color,
    val ink: Color,
    val muted: Color,
    val line: Color,
    val accent: Color,
    val soft: Color,
    val bubble: Color,
    val chat: Color,
)

internal val LocalChatPalette = staticCompositionLocalOf { lightPalette }
private val lightPalette =
    ChatPalette(
        Color(0xFFF2F5F1),
        Color.White,
        Color(0xFF19372F),
        Color(0xFF697C75),
        Color(0xFFE2E9E3),
        Color(0xFF186B50),
        Color(0xFFE9F2E4),
        Color(0xFFDCEECF),
        Color(0xFFEDF2E9),
    )
private val darkPalette =
    ChatPalette(
        Color(0xFF0E1714),
        Color(0xFF15231E),
        Color(0xFFE4EEE7),
        Color(0xFF9CB0A4),
        Color(0xFF2A3C32),
        Color(0xFFA4D689),
        Color(0xFF263C2E),
        Color(0xFF2B4936),
        Color(0xFF101D17),
    )

@Composable
internal fun MenChatTheme(dark: Boolean, content: @Composable () -> Unit) {
    val p = if (dark) darkPalette else lightPalette
    val colors =
        if (dark)
            darkColorScheme(
                primary = p.accent,
                onPrimary = Color(0xFF11251A),
                background = p.canvas,
                onBackground = p.ink,
                surface = p.panel,
                onSurface = p.ink,
                surfaceVariant = p.soft,
                onSurfaceVariant = p.muted,
                outline = p.line,
                secondaryContainer = p.bubble,
                onSecondaryContainer = p.ink,
            )
        else
            lightColorScheme(
                primary = p.accent,
                onPrimary = Color.White,
                background = p.canvas,
                onBackground = p.ink,
                surface = p.panel,
                onSurface = p.ink,
                surfaceVariant = p.soft,
                onSurfaceVariant = p.muted,
                outline = p.line,
                secondaryContainer = p.bubble,
                onSecondaryContainer = p.ink,
            )
    val base = TextStyle(fontFamily = FontFamily.SansSerif)
    CompositionLocalProvider(LocalChatPalette provides p) {
        MaterialTheme(
            colorScheme = colors,
            typography =
                Typography(
                    headlineLarge =
                        base.copy(
                            fontSize = 30.sp,
                            lineHeight = 36.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    headlineSmall =
                        base.copy(
                            fontSize = 24.sp,
                            lineHeight = 30.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    titleLarge =
                        base.copy(
                            fontSize = 20.sp,
                            lineHeight = 26.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    titleMedium =
                        base.copy(
                            fontSize = 16.sp,
                            lineHeight = 22.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    bodyLarge = base.copy(fontSize = 16.sp, lineHeight = 23.sp),
                    bodyMedium = base.copy(fontSize = 14.sp, lineHeight = 21.sp),
                    bodySmall = base.copy(fontSize = 12.sp, lineHeight = 18.sp),
                    labelLarge =
                        base.copy(
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    labelSmall = base.copy(fontSize = 11.sp, lineHeight = 15.sp),
                ),
            shapes =
                Shapes(
                    small = RoundedCornerShape(10.dp),
                    medium = RoundedCornerShape(16.dp),
                    large = RoundedCornerShape(24.dp),
                ),
            content = content,
        )
    }
}

// Small stroke icons matching the web, without a font or a second icon dependency.
internal enum class Glyph(val paths: List<String>) {
    Search(listOf("M21 21l-4.3-4.3", "M19 11a8 8 0 1 1-16 0a8 8 0 0 1 16 0")),
    Plus(listOf("M12 5v14M5 12h14")),
    Settings(
        listOf(
            "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
            "M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0",
        )
    ),
    Group(
        listOf(
            "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
            "M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0",
            "M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
        )
    ),
    Back(listOf("M19 12H5m7-7-7 7 7 7")),
    Down(listOf("m6 9 6 6 6-6")),
    Close(listOf("M18 6 6 18M6 6l12 12")),
    Mic(listOf("M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z", "M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8")),
    Send(listOf("m22 2-7 20-4-9-9-4zM22 2 11 13")),
    Trash(listOf("M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7")),
    Reply(listOf("m9 10-5 5 5 5M4 15h10a6 6 0 0 0 0-12h-2")),
    Download(listOf("M12 3v12m-5-5 5 5 5-5M5 15v6h14v-6")),
    Play(listOf("m8 4 12 8-12 8z")),
    Pause(listOf("M8 4v16M16 4v16")),
    Check(listOf("m5 12 4 4L19 6")),
    Checks(listOf("m2 12 4 4L16 6m-4 10L22 6")),
    Moon(listOf("M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13")),
    Sun(
        listOf(
            "M16 12a4 4 0 1 1-8 0a4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
        )
    ),
    Chat(listOf("M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2-5A8.5 8.5 0 1 1 21 11.5")),
    Info(listOf("M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0M12 11v6M12 7v.1")),
    Logout(listOf("M9 3H3v18h6M9 12h12m-5-5 5 5-5 5")),
}

@Composable
internal fun ChatIcon(
    glyph: Glyph,
    label: String? = null,
    modifier: Modifier = Modifier,
    tint: Color = LocalChatPalette.current.muted,
) {
    val vector =
        remember(glyph) {
            ImageVector.Builder(glyph.name, 24.dp, 24.dp, 24f, 24f)
                .apply {
                    glyph.paths.forEach {
                        addPath(
                            PathParser().parsePathString(it).toNodes(),
                            fill = null,
                            stroke = SolidColor(Color.Black),
                            strokeLineWidth = 1.8f,
                            strokeLineCap = StrokeCap.Round,
                            strokeLineJoin = StrokeJoin.Round,
                        )
                    }
                }
                .build()
        }
    Icon(vector, label, modifier.size(22.dp), tint = tint)
}

@Composable
internal fun ChatIconButton(
    glyph: Glyph,
    label: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(48.dp)) {
        ChatIcon(
            glyph,
            label,
            tint = LocalChatPalette.current.muted.copy(alpha = if (enabled) 1f else .4f),
        )
    }
}

@Composable
internal fun BrandMark(compact: Boolean = false) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 12.dp),
    ) {
        Image(
            painterResource(R.mipmap.ic_launcher),
            "Logo MenChat",
            Modifier.size(if (compact) 32.dp else 52.dp),
        )
        Text(
            "MenChat",
            modifier = Modifier.weight(1f, fill = false),
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            style =
                if (compact) MaterialTheme.typography.titleLarge
                else MaterialTheme.typography.headlineLarge,
        )
    }
}

@Composable
internal fun ChatAvatar(name: String, group: Boolean, size: Int = 46) {
    val p = LocalChatPalette.current
    Box(
        Modifier.size(size.dp).background(p.soft, CircleShape).border(1.dp, p.line, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (group) ChatIcon(Glyph.Group, tint = p.accent)
        else
            Text(
                name
                    .trim()
                    .split(Regex("\\s+"))
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                    .joinToString(""),
                color = p.accent,
                fontWeight = FontWeight.SemiBold,
                fontSize = (size * .31).sp,
            )
    }
}
