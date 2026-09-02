package com.example.iwrite.ui.main

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import com.example.iwrite.FloatingWidgetService
import com.example.iwrite.data.DefaultDataRepository
import com.example.iwrite.theme.IwriteTheme
import kotlinx.coroutines.delay

// ── Colors ────────────────────────────────────────────────────────────────────
private val CoolBlue      = Color(0xFF0A84FF)
private val DeepOcean     = Color(0xFF0D2B55)
private val CyanAccent    = Color(0xFF00D4FF)
private val DarkSurface   = Color(0xFF0F1923)
private val CardSurface   = Color(0xFF162030)
private val TextPrimary   = Color(0xFFE8F4FD)
private val TextSecondary = Color(0xFF7EA8C9)
private val SuccessGreen  = Color(0xFF34D399)

@Composable
fun MainScreen(
  onItemClick: (NavKey) -> Unit,
  modifier: Modifier = Modifier,
  viewModel: MainScreenViewModel = viewModel { MainScreenViewModel(DefaultDataRepository()) },
) {
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  when (state) {
    MainScreenUiState.Loading -> { /* Blank */ }
    is MainScreenUiState.Success -> {
      MainScreen(data = (state as MainScreenUiState.Success).data, modifier = modifier)
    }
    is MainScreenUiState.Error -> {
      Text("Error loading data: ${(state as MainScreenUiState.Error).throwable.message}")
    }
  }
}

@Composable
internal fun MainScreen(data: List<String>, modifier: Modifier = Modifier) {
  val context = LocalContext.current

  // Sync state
  var isSyncing by remember { mutableStateOf(false) }
  var syncDone by remember { mutableStateOf(false) }

  // Widget running state
  var widgetRunning by remember { mutableStateOf(false) }

  // Sync animation
  val infiniteTransition = rememberInfiniteTransition(label = "sync_spin")
  val syncRotation by infiniteTransition.animateFloat(
    initialValue = 0f, targetValue = 360f,
    animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing), RepeatMode.Restart),
    label = "sync_rotation"
  )

  LaunchedEffect(isSyncing) {
    if (isSyncing) {
      delay(1800)
      isSyncing = false
      syncDone = true
      delay(2500)
      syncDone = false
    }
  }

  Surface(
    modifier = modifier.fillMaxSize(),
    color = DarkSurface
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(20.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {

      // ── Header ────────────────────────────────────────────────────────────
      Text(
        text = "iwrite",
        fontSize = 36.sp,
        fontWeight = FontWeight.ExtraBold,
        color = CoolBlue,
        modifier = Modifier.padding(top = 8.dp)
      )
      Text(
        text = "Voice notes · synced everywhere",
        fontSize = 13.sp,
        color = TextSecondary
      )

      Spacer(Modifier.height(4.dp))

      // ── Sync Button ───────────────────────────────────────────────────────
      Button(
        onClick = { if (!isSyncing && !syncDone) isSyncing = true },
        modifier = Modifier
          .fillMaxWidth()
          .height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
          containerColor = if (syncDone) SuccessGreen else CoolBlue,
          contentColor = Color.White
        ),
        enabled = !isSyncing
      ) {
        when {
          isSyncing -> {
            CircularProgressIndicator(
              modifier = Modifier.size(20.dp),
              color = Color.White,
              strokeWidth = 2.5.dp
            )
            Spacer(Modifier.width(10.dp))
            Text("Syncing…", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
          }
          syncDone -> {
            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Synced!", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
          }
          else -> {
            Icon(
              Icons.Default.Refresh,
              contentDescription = null,
              modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text("Sync Now", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
          }
        }
      }

      // ── Widget Launch / Stop ──────────────────────────────────────────────
      WidgetControlCard(
        widgetRunning = widgetRunning,
        onToggle = { running ->
          if (running) {
            // Request overlay permission if needed
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
              !Settings.canDrawOverlays(context)
            ) {
              val permIntent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
              )
              permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              context.startActivity(permIntent)
            } else {
              FloatingWidgetService.start(context)
              widgetRunning = true
            }
          } else {
            FloatingWidgetService.stop(context)
            widgetRunning = false
          }
        }
      )

      // ── How to Record Info Card ───────────────────────────────────────────
      RecordingGuideCard()

      // ── Notes list ───────────────────────────────────────────────────────
      Spacer(Modifier.height(4.dp))
      Text(
        "Your Notes",
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        color = TextPrimary
      )
      data.forEach { item ->
        NoteItem(item)
      }
    }
  }
}

// ── Widget Control Card ───────────────────────────────────────────────────────

@Composable
private fun WidgetControlCard(
  widgetRunning: Boolean,
  onToggle: (Boolean) -> Unit
) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(16.dp))
      .background(
        Brush.horizontalGradient(listOf(DeepOcean, Color(0xFF0D3A6E)))
      )
      .padding(16.dp)
  ) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween,
      modifier = Modifier.fillMaxWidth()
    ) {
      Column {
        Text(
          "Floating Widget",
          color = TextPrimary,
          fontWeight = FontWeight.SemiBold,
          fontSize = 15.sp
        )
        Text(
          if (widgetRunning) "● Active – breathing blue" else "○ Not running",
          color = if (widgetRunning) CyanAccent else TextSecondary,
          fontSize = 12.sp
        )
      }

      // Animated breathing indicator when running
      if (widgetRunning) {
        val pulse = rememberInfiniteTransition(label = "pulse")
        val alpha by pulse.animateFloat(
          initialValue = 0.4f, targetValue = 1f,
          animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
          label = "alpha"
        )
        Box(
          modifier = Modifier
            .size(14.dp)
            .clip(CircleShape)
            .background(CoolBlue.copy(alpha = alpha))
        )
      }

      OutlinedButton(
        onClick = { onToggle(!widgetRunning) },
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(
          contentColor = if (widgetRunning) Color(0xFFFF6B6B) else CoolBlue
        )
      ) {
        Text(
          if (widgetRunning) "Stop" else "Launch",
          fontWeight = FontWeight.SemiBold,
          fontSize = 13.sp
        )
      }
    }
  }
}

// ── Recording Guide Card ──────────────────────────────────────────────────────

@Composable
private fun RecordingGuideCard() {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(16.dp))
      .background(CardSurface)
      .padding(16.dp)
  ) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(
        "🎙 How to Record Voice Notes",
        color = CyanAccent,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp
      )
      GuideStep("1", "Tap Launch to start the floating blue widget")
      GuideStep("2", "Tap the widget once → recording begins")
      GuideStep("3", "Tap again → recording stops & app opens")
      GuideStep("★", "Long-press widget → popup: Open / Record / Remove")
    }
  }
}

@Composable
private fun GuideStep(num: String, text: String) {
  Row(verticalAlignment = Alignment.Top) {
    Text(
      text = num,
      color = CoolBlue,
      fontWeight = FontWeight.Bold,
      fontSize = 12.sp,
      modifier = Modifier.width(20.dp)
    )
    Text(
      text = text,
      color = TextSecondary,
      fontSize = 12.sp,
      lineHeight = 18.sp
    )
  }
}

// ── Note Item ─────────────────────────────────────────────────────────────────

@Composable
fun NoteItem(name: String, modifier: Modifier = Modifier) {
  Box(
    modifier = modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(12.dp))
      .background(CardSurface)
      .padding(14.dp)
  ) {
    Text(text = name, color = TextPrimary, fontSize = 14.sp)
  }
}

// Legacy alias used in Navigation.kt
@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
  NoteItem(name = name, modifier = modifier)
}

// ── Previews ──────────────────────────────────────────────────────────────────

@Preview(showBackground = true)
@Composable
fun MainScreenPreview() {
  IwriteTheme { MainScreen(listOf("Voice note 1", "Voice note 2")) }
}

@Preview(showBackground = true, widthDp = 340)
@Composable
fun MainScreenPortraitPreview() {
  IwriteTheme { MainScreen(listOf("Voice note 1")) }
}
