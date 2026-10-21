import type { AgentStatus, AppConfig, NexusBridge } from "../../shared/types";
import { icon } from "../shared/icons";

declare global {
  interface Window {
    nexus: NexusBridge;
  }
}

const api = window.nexus;
const root = document.getElementById("app") as HTMLElement;
document.body.classList.add(`os-${api.platform}`);

root.innerHTML = `
<div class="aurora"><i></i><i></i><i></i></div>
<div class="titlebar"></div>
<main class="wrap">
  <header class="hero">
    <div class="logo">${icon("home", 30)}</div>
    <h1>Nexus Desktop</h1>
    <p id="lead">Conecte este computador ao seu Core para controlar dispositivos pelo widget e deixar o PC controlável remotamente.</p>
  </header>

  <form id="form" class="card" autocomplete="off">
    <label class="field" style="--i:0"><span>URL do Core</span>
      <input id="coreUrl" type="text" placeholder="https://core.seudominio.com  ou  http://192.168.1.10:4700" spellcheck="false" />
    </label>
    <label class="field" style="--i:1"><span>API key</span>
      <input id="apiKey" type="password" placeholder="nxk_…" spellcheck="false" />
      <small>Gere em Dashboard → API Keys (permissões: ler e controlar dispositivos). Fica guardada criptografada neste computador.</small>
    </label>
    <div class="row">
      <label class="field" style="--i:2"><span>Nome deste computador</span><input id="deviceName" type="text" placeholder="PC-da-Sala" /></label>
      <label class="field" style="--i:3"><span>Nome do ambiente (widget)</span><input id="environmentName" type="text" placeholder="Minha Casa" /></label>
    </div>

    <label class="toggle" style="--i:4"><input id="runAgent" type="checkbox" /><i></i>
      <span><b>Permitir controle remoto deste computador</b><small>Executa o Agent: aparece no Dashboard (após aprovar) e aceita desligar, reiniciar e bloquear.</small></span></label>
    <label class="toggle" style="--i:5"><input id="launchAtLogin" type="checkbox" /><i></i>
      <span><b>Iniciar com o sistema</b><small>Abre na bandeja ao ligar o computador.</small></span></label>

    <div id="result" class="result" role="status"></div>
    <div class="actions">
      <button type="button" id="test" class="ghost">Testar conexão</button>
      <button type="submit" id="save" class="primary">Salvar</button>
    </div>
  </form>

  <section class="agent card" id="agentCard"><span class="agent-dot" id="agentDot"></span><div><b id="agentTitle">Agent</b><small id="agentDetail"></small></div></section>
  <footer class="foot"><span id="version"></span><button id="quit" class="link">Sair do Nexus</button></footer>
</main>`;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const input = (id: string): HTMLInputElement => $<HTMLInputElement>(id);

function fill(config: AppConfig): void {
  input("coreUrl").value = config.coreUrl;
  input("apiKey").value = "";
  input("apiKey").placeholder = config.hasApiKey ? "•••••••• (salva — deixe vazio para manter)" : "nxk_…";
  input("deviceName").value = config.deviceName;
  input("environmentName").value = config.environmentName;
  input("runAgent").checked = config.runAgent;
  input("launchAtLogin").checked = config.launchAtLogin;
  if (config.demo) $("lead").textContent = "Modo demonstração ativo — nenhum Core é necessário.";
}

function showResult(message: string, state: "ok" | "bad" | "busy" | ""): void {
  const el = $("result");
  el.textContent = message;
  el.dataset.state = state;
  el.classList.toggle("show", message.length > 0);
}

const AGENT_TEXT: Record<AgentStatus["state"], [string, string]> = {
  disabled: ["Agent desligado", "Este computador não aparece no Dashboard."],
  starting: ["Iniciando…", "Conectando ao Core."],
  pending: ["Aguardando aprovação", "Abra o Dashboard → Agents e aprove este computador."],
  online: ["Agent online", "Este computador está visível e controlável."],
  offline: ["Agent offline", "Tentando reconectar."],
  rejected: ["Agent rejeitado", "O Core recusou este computador."],
};

function showAgent(status: AgentStatus): void {
  const [title, detail] = AGENT_TEXT[status.state];
  $("agentTitle").textContent = title;
  $("agentDetail").textContent = status.detail ?? detail;
  $("agentDot").dataset.state = status.state;
}

$("test").addEventListener("click", async () => {
  showResult("Testando…", "busy");
  const result = await api.testConnection(input("coreUrl").value, input("apiKey").value);
  showResult(result.message, result.ok ? "ok" : "bad");
});

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const save = $<HTMLButtonElement>("save");
  save.disabled = true;
  showResult("Salvando…", "busy");
  const config = await api.saveConfig({
    coreUrl: input("coreUrl").value,
    apiKey: input("apiKey").value,
    deviceName: input("deviceName").value,
    environmentName: input("environmentName").value,
    runAgent: input("runAgent").checked,
    launchAtLogin: input("launchAtLogin").checked,
  });
  fill(config);
  const test = await api.testConnection(config.coreUrl);
  showResult(test.ok ? `Salvo · ${test.message}` : `Salvo, mas: ${test.message}`, test.ok ? "ok" : "bad");
  save.disabled = false;
  if (test.ok) setTimeout(() => api.closeSettings(), 1100);
});

$("quit").addEventListener("click", () => api.quit());
api.onAgentStatus(showAgent);

void (async () => {
  const [config, status, version] = await Promise.all([api.getConfig(), api.getAgentStatus(), api.getVersion()]);
  fill(config);
  showAgent(status);
  $("version").textContent = `Nexus Desktop ${version}`;
})();
