import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Settings, Key, CheckCircle, XCircle, Loader2, Bell, RefreshCw, Eye, EyeOff, Cpu, Zap, Send, MessageCircle } from 'lucide-react';
import { testConnection } from '../services/groqService';
import { sendTelegramMessage, buildDailyDigest } from '../services/telegramService';

export default function SettingsPage() {
  const { settings, updateSettings, addLog } = useAppStore();
  const [apiKeyInput, setApiKeyInput] = useState(settings.groqApiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [telegramTesting, setTelegramTesting] = useState(false);

  async function handleTestConnection() {
    if (!apiKeyInput || testing) return;
    setTesting(true);
    setConnectionStatus('idle');
    addLog({ agentName: 'Sistema', message: 'Probando conexión con Groq API...', type: 'info' });
    try {
      const ok = await testConnection(apiKeyInput);
      setConnectionStatus(ok ? 'ok' : 'fail');
      if (ok) {
        updateSettings({ groqApiKey: apiKeyInput });
        addLog({ agentName: 'Sistema', message: 'Conexión con Groq API exitosa. API key guardada.', type: 'success' });
      } else {
        addLog({ agentName: 'Sistema', message: 'Falló la conexión con Groq API. Verifica tu API key.', type: 'error' });
      }
    } catch {
      setConnectionStatus('fail');
      addLog({ agentName: 'Sistema', message: 'Error al conectar con Groq API', type: 'error' });
    } finally {
      setTesting(false);
    }
  }

  function handleSaveKey() {
    updateSettings({ groqApiKey: apiKeyInput });
    addLog({ agentName: 'Sistema', message: 'API key de Groq guardada', type: 'success' });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <p className="text-gray-500 text-sm">Configura los parámetros del sistema de agentes y la integración con Groq AI.</p>

      {/* Groq API Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Key size={16} className="text-yellow-500" /> API Key de Groq
        </h3>
        <p className="text-gray-500 text-sm">
          Obtén tu API key gratuita en{' '}
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">
            console.groq.com
          </a>
          . Se usa para análisis de descuentos y predicciones IA.
        </p>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm pr-10 focus:outline-none focus:border-yellow-500"
              placeholder="gsk_..."
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setConnectionStatus('idle');
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            disabled={!apiKeyInput}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={handleTestConnection}
            disabled={!apiKeyInput || testing}
            className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Probar
          </button>
        </div>

        {/* Connection status */}
        {connectionStatus !== 'idle' && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            connectionStatus === 'ok'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {connectionStatus === 'ok' ? (
              <><CheckCircle size={16} /> Conexión exitosa con Groq API. Lista para análisis IA.</>
            ) : (
              <><XCircle size={16} /> No se pudo conectar. Verifica tu API key y vuelve a intentar.</>
            )}
          </div>
        )}

        {settings.groqApiKey && (
          <div className="flex items-center gap-2 text-green-400 text-xs">
            <CheckCircle size={13} />
            API key configurada y guardada
          </div>
        )}
      </div>

      {/* Auto-scan toggle */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Zap size={16} className="text-green-500" /> Auto-escaneo Inteligente
        </h3>
        <label className="flex items-start gap-3 cursor-pointer">
          <div
            onClick={() => updateSettings({ autoScanEnabled: !settings.autoScanEnabled })}
            className={`relative mt-0.5 w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              settings.autoScanEnabled ? 'bg-green-500' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.autoScanEnabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
          <div>
            <span className="text-gray-300 text-sm font-medium">
              {settings.autoScanEnabled ? '⚡ Auto-escaneo activado' : 'Auto-escaneo desactivado'}
            </span>
            <p className="text-gray-500 text-xs mt-0.5">
              {settings.autoScanEnabled
                ? `Buscando nuevos descuentos cada ${settings.scanIntervalMinutes} min de forma automática`
                : 'Activa para buscar descuentos nuevos sin tocar ningún botón'}
            </p>
          </div>
        </label>
        {settings.autoScanEnabled && !settings.groqApiKey && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
            ⚠️ Configura tu API key de Groq arriba para que el auto-escaneo funcione.
          </div>
        )}
        {settings.autoScanEnabled && settings.groqApiKey && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-green-500/10 border border-green-500/30 text-green-400">
            <CheckCircle size={14} /> Activo — escaneando cada {settings.scanIntervalMinutes} min. Usa el botón ⚡ Auto en el header para controlar el conteo.
          </div>
        )}
      </div>

      {/* Scan settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Cpu size={16} className="text-blue-500" /> Configuración de Escaneo
        </h3>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">
            Intervalo de escaneo automático: <span className="text-white font-semibold">{settings.scanIntervalMinutes} minutos</span>
          </label>
          <input
            type="range"
            min={15}
            max={360}
            step={15}
            value={settings.scanIntervalMinutes}
            onChange={(e) => updateSettings({ scanIntervalMinutes: Number(e.target.value) })}
            className="w-full accent-yellow-500"
          />
          <div className="flex justify-between text-gray-600 text-xs mt-1">
            <span>15 min</span>
            <span>360 min</span>
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">
            Máx. empresas por ciclo: <span className="text-white font-semibold">{settings.maxCompaniesPerScan}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={settings.maxCompaniesPerScan}
            onChange={(e) => updateSettings({ maxCompaniesPerScan: Number(e.target.value) })}
            className="w-full accent-yellow-500"
          />
          <div className="flex justify-between text-gray-600 text-xs mt-1">
            <span>1</span>
            <span>20</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <Bell size={16} className="text-purple-500" /> Notificaciones del Navegador
        </h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.notificationsEnabled ? 'bg-yellow-500' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
          <span className="text-gray-300 text-sm">
            {settings.notificationsEnabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
          </span>
        </label>
        <p className="text-gray-600 text-xs mt-2 ml-14">Alertas emergentes del navegador cuando se detecten nuevos descuentos</p>
      </div>

      {/* Telegram */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <MessageCircle size={16} className="text-blue-400" /> Notificaciones por Telegram
        </h3>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 text-xs text-gray-400 space-y-1">
          <p className="text-blue-300 font-semibold mb-2">📋 Cómo configurar (3 pasos):</p>
          <p><span className="text-white">1.</span> Abre Telegram y busca <code className="bg-gray-800 px-1 rounded">@BotFather</code></p>
          <p><span className="text-white">2.</span> Envía <code className="bg-gray-800 px-1 rounded">/newbot</code> → pon un nombre → copia el <b className="text-white">Token</b></p>
          <p><span className="text-white">3.</span> Busca <code className="bg-gray-800 px-1 rounded">@userinfobot</code> → envía <code className="bg-gray-800 px-1 rounded">/start</code> → copia tu <b className="text-white">Chat ID</b></p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs mb-1.5 block font-medium">Bot Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="123456789:ABCdefGHIjklMNO..."
                value={settings.telegramBotToken}
                onChange={(e) => { updateSettings({ telegramBotToken: e.target.value }); setTelegramStatus('idle'); }}
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1.5 block font-medium">Chat ID</label>
            <input
              type="text"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="123456789"
              value={settings.telegramChatId}
              onChange={(e) => { updateSettings({ telegramChatId: e.target.value }); setTelegramStatus('idle'); }}
            />
          </div>

          <button
            onClick={async () => {
              if (!settings.telegramBotToken || !settings.telegramChatId || telegramTesting) return;
              setTelegramTesting(true);
              setTelegramStatus('idle');
              const msg = `✅ <b>Maestricos conectado</b>\n\nTelegram configurado correctamente.\nRecibirás notificaciones de descuentos aquí 🛍️`;
              const r = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
              setTelegramStatus(r.ok ? 'ok' : 'fail');
              setTelegramTesting(false);
            }}
            disabled={!settings.telegramBotToken || !settings.telegramChatId || telegramTesting}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {telegramTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar mensaje de prueba
          </button>

          {telegramStatus === 'ok' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-green-500/10 border border-green-500/30 text-green-400">
              <CheckCircle size={14} /> ¡Perfecto! Telegram configurado. Revisa tu chat.
            </div>
          )}
          {telegramStatus === 'fail' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
              <XCircle size={14} /> Error. Verifica el Bot Token y Chat ID.
            </div>
          )}

          {settings.telegramBotToken && settings.telegramChatId && telegramStatus !== 'fail' && (
            <button
              onClick={async () => {
                const { discounts } = useAppStore.getState();
                const msg = buildDailyDigest(discounts);
                await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, msg);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <MessageCircle size={13} /> Enviar resumen de descuentos ahora
            </button>
          )}
        </div>
      </div>

      {/* System info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Settings size={16} className="text-gray-500" /> Información del Sistema
        </h3>
        <div className="space-y-2 text-sm">
          {[
            ['Versión', '1.0.0'],
            ['Motor IA', 'Groq LLaMA 3.1 8B Instant'],
            ['Modelo de análisis', 'LLaMA 3.3 70B Versatile'],
            ['Empresas monitoreadas', '173'],
            ['Agentes disponibles', '5'],
            ['Base de datos', 'Local (localStorage v4)'],
            ['Framework', 'React 18 + Vite + TypeScript'],
          ].map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500">{key}</span>
              <span className="text-gray-300">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
