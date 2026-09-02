package com.example.iwrite

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Shader
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.GestureDetector
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.PopupMenu
import android.widget.Toast
import androidx.core.app.NotificationCompat

class FloatingWidgetService : Service() {

    companion object {
        const val CHANNEL_ID = "iwrite_widget_channel"
        const val NOTIFICATION_ID = 1001
        const val LONG_PRESS_DURATION = 500L

        fun start(context: Context) {
            val intent = Intent(context, FloatingWidgetService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, FloatingWidgetService::class.java))
        }
    }

    private lateinit var windowManager: WindowManager
    private lateinit var widgetView: View
    private lateinit var widgetRoot: FrameLayout
    private lateinit var micIndicator: MicBubbleView
    private lateinit var params: WindowManager.LayoutParams

    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var recordingOutputPath: String? = null

    private val handler = Handler(Looper.getMainLooper())
    private var breathAnimator: ObjectAnimator? = null

    // Drag state
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    // Long-press detection
    private var longPressRunnable: Runnable? = null
    private var longPressTriggered = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        setupWidget()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        breathAnimator?.cancel()
        stopRecording()
        if (::widgetView.isInitialized) {
            try { windowManager.removeView(widgetView) } catch (_: Exception) {}
        }
    }

    // ─── Widget Setup ─────────────────────────────────────────────────────────

    private fun setupWidget() {
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        params = WindowManager.LayoutParams(
            dpToPx(72),
            dpToPx(72),
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            x = 60
            y = 300
        }

        // Root container
        widgetRoot = FrameLayout(this)
        widgetRoot.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )

        // Custom drawn mic bubble
        micIndicator = MicBubbleView(this)
        micIndicator.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        widgetRoot.addView(micIndicator)

        widgetView = widgetRoot
        widgetView.setOnTouchListener(createTouchListener())

        windowManager.addView(widgetView, params)
        startBreathingAnimation()
    }

    // ─── Breathing Blue Animation ──────────────────────────────────────────────

    private fun startBreathingAnimation() {
        breathAnimator = ObjectAnimator.ofFloat(widgetView, "alpha", 0.65f, 1.0f).apply {
            duration = 1800
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }

        // Also pulse scale slightly for a "breathing" feel
        val scaleX = ObjectAnimator.ofFloat(widgetView, "scaleX", 0.88f, 1.0f).apply {
            duration = 1800
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
        }
        val scaleY = ObjectAnimator.ofFloat(widgetView, "scaleY", 0.88f, 1.0f).apply {
            duration = 1800
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
        }
        scaleX.start()
        scaleY.start()
    }

    // ─── Touch Listener (drag + tap + long-press) ─────────────────────────────

    private fun createTouchListener(): View.OnTouchListener {
        return View.OnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    isDragging = false
                    longPressTriggered = false
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY

                    // Schedule long-press
                    longPressRunnable = Runnable {
                        longPressTriggered = true
                        showPopupMenu(v)
                    }
                    handler.postDelayed(longPressRunnable!!, LONG_PRESS_DURATION)
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()

                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                        // Cancel long-press if dragging
                        longPressRunnable?.let { handler.removeCallbacks(it) }
                        isDragging = true
                        params.x = initialX + dx
                        params.y = initialY + dy
                        windowManager.updateViewLayout(widgetView, params)
                    }
                    true
                }

                MotionEvent.ACTION_UP -> {
                    longPressRunnable?.let { handler.removeCallbacks(it) }
                    if (!isDragging && !longPressTriggered) {
                        // Single tap → toggle recording & open app
                        onWidgetTap()
                    }
                    true
                }

                else -> false
            }
        }
    }

    // ─── Tap Action (open app + toggle recording) ─────────────────────────────

    private fun onWidgetTap() {
        if (!isRecording) {
            // Start recording
            startRecording()
            micIndicator.setRecording(true)
            Toast.makeText(this, "🎙 Recording…", Toast.LENGTH_SHORT).show()
        } else {
            // Stop recording and open app
            stopRecording()
            micIndicator.setRecording(false)
            Toast.makeText(this, "✅ Saved. Opening iwrite…", Toast.LENGTH_SHORT).show()
            openMainActivity()
        }
    }

    private fun openMainActivity() {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
    }

    // ─── Long-press Popup Menu ────────────────────────────────────────────────

    private fun showPopupMenu(anchor: View) {
        breathAnimator?.pause()
        widgetView.alpha = 1.0f
        widgetView.scaleX = 1.0f
        widgetView.scaleY = 1.0f

        val popup = PopupMenu(this, anchor)
        popup.menu.add(0, 1, 0, "▶  Open iwrite")
        popup.menu.add(0, 2, 1, "🎙  Start Recording")
        popup.menu.add(0, 3, 2, "✕  Remove Widget")

        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> openMainActivity()
                2 -> {
                    if (!isRecording) {
                        startRecording()
                        micIndicator.setRecording(true)
                        Toast.makeText(this, "🎙 Recording started", Toast.LENGTH_SHORT).show()
                    } else {
                        stopRecording()
                        micIndicator.setRecording(false)
                        Toast.makeText(this, "✅ Recording saved", Toast.LENGTH_SHORT).show()
                    }
                }
                3 -> stopSelf()
            }
            true
        }
        popup.setOnDismissListener {
            breathAnimator?.resume()
        }
        popup.show()
    }

    // ─── Voice Recording ──────────────────────────────────────────────────────

    private fun startRecording() {
        try {
            val dir = getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            recordingOutputPath = "${dir?.absolutePath}/iwrite_${System.currentTimeMillis()}.m4a"

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION") MediaRecorder()
            }

            mediaRecorder!!.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(recordingOutputPath)
                prepare()
                start()
            }
            isRecording = true
        } catch (e: Exception) {
            Toast.makeText(this, "Could not start recording: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopRecording() {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
        } catch (_: Exception) {
        } finally {
            mediaRecorder = null
            isRecording = false
        }
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                "iwrite Widget",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "iwrite floating widget is active"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(chan)
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, FloatingWidgetService::class.java).apply { action = "STOP" },
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("iwrite Widget Active")
            .setContentText("Tap to open · Long-press to remove")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Remove", stopIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()
}

// ─── Custom Drawn Mic Bubble ──────────────────────────────────────────────────

class MicBubbleView(context: Context) : View(context) {

    private var recording = false
    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        color = Color.parseColor("#80AAFFFF")
    }
    private val micPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }
    private val recDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FF5F57")   // red dot for "recording"
        style = Paint.Style.FILL
    }

    fun setRecording(rec: Boolean) {
        recording = rec
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val radius = minOf(cx, cy) - 6f

        // ── Gradient fill ──
        bgPaint.shader = LinearGradient(
            cx - radius, cy - radius,
            cx + radius, cy + radius,
            if (recording) intArrayOf(
                Color.parseColor("#1A3A6E"),
                Color.parseColor("#0A84FF"),
                Color.parseColor("#00D4FF")
            ) else intArrayOf(
                Color.parseColor("#0D2B55"),
                Color.parseColor("#0A52B8"),
                Color.parseColor("#00AAEE")
            ),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius, bgPaint)

        // ── Rim ──
        canvas.drawCircle(cx, cy, radius, rimPaint)

        // ── Mic body ──
        val micW = radius * 0.28f
        val micH = radius * 0.46f
        val micTop = cy - micH * 0.7f
        val rect = android.graphics.RectF(cx - micW, micTop, cx + micW, micTop + micH)
        canvas.drawRoundRect(rect, micW, micW, micPaint)

        // ── Mic stand ──
        val standPaint = Paint(micPaint).apply { strokeWidth = 3.5f; style = Paint.Style.STROKE }
        val arcRect = android.graphics.RectF(cx - micW * 1.6f, micTop + micH * 0.2f, cx + micW * 1.6f, micTop + micH * 1.05f)
        canvas.drawArc(arcRect, 0f, 180f, false, standPaint)
        canvas.drawLine(cx, micTop + micH * 1.05f, cx, micTop + micH * 1.35f, standPaint)
        canvas.drawLine(cx - micW * 1.0f, micTop + micH * 1.35f, cx + micW * 1.0f, micTop + micH * 1.35f, standPaint)

        // ── Recording indicator dot ──
        if (recording) {
            canvas.drawCircle(cx + radius * 0.52f, cy - radius * 0.52f, radius * 0.17f, recDotPaint)
        }
    }
}
