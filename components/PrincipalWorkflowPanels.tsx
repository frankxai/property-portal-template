"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  emptyEvidence,
  currentObservationDate as today,
  normalizeListingUrl,
  primarySources,
  structureBrief,
  type WorkspaceAsset,
} from "@/lib/principal-workspace";

type Props = {
  section: string;
  asset: WorkspaceAsset;
  assets: WorkspaceAsset[];
  onSelect: (id: string) => void;
  onSave: (asset: WorkspaceAsset) => void;
  onNotice: (text: string) => void;
};

function downloadMarkdown(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

function AssetSelect({ asset, assets, onSelect }: Pick<Props, "asset" | "assets" | "onSelect">) {
  return <label>Objektmodell
    <select value={asset.id} onChange={(event) => onSelect(event.target.value)}>
      {assets.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}
    </select>
  </label>;
}

function canonicalListingUrl(value: string) {
  const url = new URL(normalizeListingUrl(value));
  url.hostname = "www.kleinanzeigen.de";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function listingKey(value: string) {
  try {
    const normalized = canonicalListingUrl(value);
    const lastSegment = new URL(normalized).pathname.split("/").pop() ?? "";
    const listingId = lastSegment.match(/^(\d{6,})-\d+-\d+$/)?.[1];
    return listingId ? `listing:${listingId}` : normalized;
  } catch { return null; }
}

function SourcePanel({ asset, assets, onSelect, onSave, onNotice }: Props) {
  const [url, setUrl] = useState(asset.sourceUrl ?? "");
  const [observedAt, setObservedAt] = useState(asset.observedAt ?? today());
  const [error, setError] = useState("");
  const providerSource = primarySources.find((source) => source.id === "kleinanzeigen")!;
  useEffect(() => {
    setUrl(asset.sourceUrl ?? "");
    setObservedAt(asset.observedAt ?? today());
    setError("");
  }, [asset.sourceUrl, asset.observedAt]);

  function attachSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let normalized: string;
    try { normalized = canonicalListingUrl(url); }
    catch { setError("Bitte eine vollständige HTTPS-Inseratadresse von Kleinanzeigen eingeben."); return; }
    const date = new Date(`${observedAt}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== observedAt) {
      setError("Bitte ein gültiges Erfassungsdatum eingeben."); return;
    }
    if (observedAt > today()) { setError("Das Erfassungsdatum darf nicht in der Zukunft liegen."); return; }
    const duplicate = assets.find((item) => item.id !== asset.id && item.sourceUrl && listingKey(item.sourceUrl) === listingKey(normalized));
    if (duplicate) { setError(`Dieser Quellenverweis gehört bereits zu „${duplicate.label}“. Bitte das bestehende Objektmodell verwenden.`); return; }
    onSave({ ...asset, sourceUrl: normalized, observedAt, evidence: emptyEvidence() });
    setUrl(normalized);
    onNotice("Quellenverweis gespeichert. Modellzahlen bleiben bestehen; alle Belege stehen wieder auf offen.");
  }

  return <div className="pw-two-column">
    <section className="pw-panel">
      <span className="pw-tag teal">Quellenzuordnung</span>
      <h2 className="pw-panel-title">Ein Inserat, ein Objektmodell.</h2>
      <p className="pw-prose">Dokumentiere Herkunft und Erfassungsdatum. Der Verweis bildet den Ausgangspunkt für den Abgleich mit Unterlagen.</p>
      <form className="pw-form" onSubmit={attachSource} noValidate>
        <AssetSelect asset={asset} assets={assets} onSelect={onSelect} />
        <label>Inseratadresse
          <input type="url" value={url} maxLength={600} placeholder="https://www.kleinanzeigen.de/s-anzeige/…" onChange={(event) => { setUrl(event.target.value); setError(""); }} autoComplete="off" required />
        </label>
        <label>Von dir erfasst am
          <input type="date" value={observedAt} max={today()} onChange={(event) => { setObservedAt(event.target.value); setError(""); }} required />
        </label>
        <p className="pw-field-note">Gespeichert wird der Quellenverweis. Die Seite ruft kein Inserat ab und bestätigt keine Inseratdaten. Bestehende Finanzannahmen bleiben bestehen; Belegbestätigungen werden zurückgesetzt.</p>
        {error && <p className="pw-form-error" role="alert">{error}</p>}
        <button className="pw-button" type="submit">Quelle zuordnen</button>
      </form>
      {asset.sourceUrl && <p className="pw-field-note">Aktueller Verweis: <a href={asset.sourceUrl} target="_blank" rel="noreferrer">Inserat öffnen</a> · {asset.observedAt ?? "Datum offen"}</p>}
    </section>
    <section className="pw-panel">
      <span className="pw-tag amber">Nicht verbunden</span>
      <h2 className="pw-panel-title">OpenImmo für die Veröffentlichung.</h2>
      <p className="pw-prose">Die professionelle Kleinanzeigen-Schnittstelle setzt eine gebuchte Partnerschaft und individuelle FTP-Zugangsdaten voraus. Sie dient der Übermittlung eigener Inserate.</p>
      <ol className="pw-prose">
        <li>Gewerbliche Partnerschaft und freigeschaltete Schnittstelle beim Anbieter klären.</li>
        <li>Objektdaten, Medienrechte und Eigentümerfreigabe für die Veröffentlichung zusammenstellen.</li>
        <li>Übertragung und Rückmeldung in einer separat autorisierten Anbindung prüfen.</li>
      </ol>
      <p className="pw-field-note">Diese Arbeitsfläche führt keine Veröffentlichung, Suchabfrage oder Nachricht im Kleinanzeigen-Konto aus.</p>
      <a className="pw-button secondary" href={providerSource.url} target="_blank" rel="noreferrer">Anbieter-Schnittstelle prüfen ↗</a>
    </section>
  </div>;
}

function StructurePanel({ asset, assets, onSelect, onNotice }: Props) {
  const [ownershipStage, setOwnershipStage] = useState<"" | "existing" | "new">("");
  const [residence, setResidence] = useState("");
  const [goal, setGoal] = useState("");
  const [holding, setHolding] = useState<"" | "yes" | "no">("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState("");

  function exportBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!ownershipStage || !holding || residence.trim().length < 2 || goal.trim().length < 5) {
      setError("Bitte Vermögensstatus, Steueransässigkeit, Ziel und bestehende Holding angeben."); return;
    }
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) {
      setError("Bitte das tatsächliche Betrachtungsjahr als vierstellige Jahreszahl eingeben."); return;
    }
    const brief = structureBrief({ existing: ownershipStage === "existing", residence: residence.trim(), goal: goal.trim(), hasHolding: holding === "yes", year });
    downloadMarkdown(`struktur-arbeitsbrief-${asset.id}-${year}.md`, `${brief}\nObjektmodell: ${asset.label} (${asset.id}). Die Zuordnung ersetzt keine Eigentumsprüfung.\n`);
    onNotice("Struktur-Arbeitsbrief exportiert. Er enthält die Eingaben, Vergleichsfragen und Primärquellen.");
  }

  return <>
    <div className="pw-two-column">
      <section className="pw-panel">
        <span className="pw-tag teal">Strukturentscheidung</span>
        <h2 className="pw-panel-title">Cashflow bis zum Eigentümer betrachten.</h2>
        <p className="pw-prose">Bestand und Neuerwerb brauchen getrennte Rechnungen. Der Arbeitsbrief legt die gemeinsame Datengrundlage für Steuerberatung und Notariat fest.</p>
        <form className="pw-form" onSubmit={exportBrief} noValidate>
          <AssetSelect asset={asset} assets={assets} onSelect={onSelect} />
          <div className="pw-form-pair">
            <label>Vermögensstatus
              <select value={ownershipStage} onChange={(event) => { setOwnershipStage(event.target.value as typeof ownershipStage); setError(""); }} required>
                <option value="">Bitte festlegen</option><option value="existing">Bestandsvermögen</option><option value="new">Neuerwerb</option>
              </select>
            </label>
            <label>Betrachtungsjahr
              <input value={year} onChange={(event) => { setYear(event.target.value); setError(""); }} inputMode="numeric" maxLength={4} required />
            </label>
          </div>
          <label>Steueransässigkeit des Eigentümers
            <input value={residence} onChange={(event) => { setResidence(event.target.value); setError(""); }} placeholder="Land; bei Auslandsbezug weitere relevante Länder" minLength={2} maxLength={160} required />
          </label>
          <label>Holding bereits vorhanden?
            <select value={holding} onChange={(event) => { setHolding(event.target.value as typeof holding); setError(""); }} required>
              <option value="">Bitte festlegen</option><option value="yes">Ja, laut Eigentümerangabe</option><option value="no">Nein</option>
            </select>
          </label>
          <label>Kapital- und Entnahmeziel
            <textarea value={goal} onChange={(event) => { setGoal(event.target.value); setError(""); }} placeholder="Reinvestition, private Liquidität, geplanter Ausstieg und Zeithorizont" rows={3} minLength={5} maxLength={600} required />
          </label>
          {error && <p className="pw-form-error" role="alert">{error}</p>}
          <button type="submit" className="pw-button">Arbeitsbrief exportieren</button>
        </form>
      </section>
      <section className="pw-panel">
        <h2 className="pw-panel-title">Drei Varianten. Gleiche Ausgangsdaten.</h2>
        <div className="pw-structure-table">
          <table>
            <thead><tr><th scope="col">Variante</th><th scope="col">Entscheidender Vergleich</th></tr></thead>
            <tbody>
              <tr><th scope="row">Privatvermögen</th><td>Laufende Steuerbelastung, private Liquidität und konkreter Verkaufsfall. Ansässigkeit, Erwerbszeitpunkt und Nutzung belegen.</td></tr>
              <tr><th scope="row">Direkte Objektgesellschaft</th><td>Cashflow in der Gesellschaft und nach Ausschüttung. Körperschaftsteuer des Jahres, Gewerbesteuer und laufende Kosten prüfen.</td></tr>
              <tr><th scope="row">Holding mit Objektgesellschaft</th><td>Reinvestition und Beteiligungswege. Entnahmen, zusätzliche Verwaltung sowie Objekt- und Anteilsverkauf getrennt rechnen.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="pw-field-note">Keine Variante ist bereits empfohlen. Bei Bestandsübertragung gehören Steuerfolgen, Transaktionskosten und Bankzustimmung in die Rechnung.</p>
        <p className="pw-prose">Beteiligungsregeln nach § 8b KStG sind keine pauschale Steuerbefreiung für Mieteinnahmen. Für die erweiterte Grundstückskürzung zählen Antrag, tatsächliche Tätigkeit und gesetzliche Bedingungen.</p>
      </section>
    </div>
    <section className="pw-panel">
      <h2 className="pw-panel-title">Primärquellen für die Fallprüfung.</h2>
      <p className="pw-field-note">Quellenstand 12.09.2026 · Vor der Entscheidung auf das tatsächliche Jahr und den Sachverhalt anwenden lassen.</p>
      <div className="pw-source-grid">
        {primarySources.slice(0, 3).map((source) => <article key={source.id}>
          <span className="pw-tag">{source.authority}</span>
          <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3>
          <p className="pw-prose">{source.note}</p>
        </article>)}
      </div>
    </section>
  </>;
}

type TenantCategory = "maintenance" | "accounting" | "contract";
const tenantCategories: Record<TenantCategory, string> = {
  maintenance: "Mangel / Instandhaltung", accounting: "Abrechnung / Zahlungszuordnung", contract: "Vertragsfrage",
};

function makeTenantDraft(category: TenantCategory, description: string, acute: boolean) {
  const content = {
    maintenance: {
      action: "Zustand und Dringlichkeit mit datierten Belegen klären; zuständige Person für Besichtigung und gegebenenfalls Instandsetzung bestimmen.",
      evidence: "Betroffener Bereich, Beginn und Verlauf, sichere Fotoaufnahmen, frühere Meldungen und relevante Vertragsunterlagen.",
      subject: "Prüfung des gemeldeten Zustands",
      reply: "Bitte ergänzen Sie, soweit noch offen, seit wann der Zustand besteht, welcher Bereich betroffen ist und wie sich die Nutzung auswirkt. Datiertes Bildmaterial kann die Prüfung unterstützen, sofern es gefahrlos erstellt werden kann.\n\nNach Prüfung der Angaben stimmen wir den nächsten Schritt und gegebenenfalls einen Besichtigungstermin ab. Zuständigkeit und Rückmeldedatum: [vor Versand festlegen].",
    },
    accounting: {
      action: "Abrechnungszeitraum und beanstandete Position bestimmen; Rechenweg, Zuordnung und zugehörige Belege abgleichen. Eine konkrete Rückmeldung vorbereiten.",
      evidence: "Abrechnungszeitraum, betroffene Position und Betrag, Abrechnungsauszug, Umlageschlüssel sowie zugehörige Belege; personenbezogene Daten separat halten.",
      subject: "Klärung Ihrer Abrechnungsfrage",
      reply: "Bitte benennen Sie, soweit noch offen, den Abrechnungszeitraum, die betroffene Position und den Betrag, den Sie klären möchten.\n\nWir prüfen dazu den Rechenweg, die Zuordnung und die Beleggrundlage. Die konkrete Erläuterung folgt nach diesem Abgleich. Zuständigkeit und Rückmeldedatum: [vor Versand festlegen].",
    },
    contract: {
      action: "Konkrete Vertragsstelle, gewünschte Klärung und betroffene Fristen identifizieren. Bei rechtlichen Folgen eine qualifizierte Prüfung vor der Antwort einholen.",
      evidence: "Relevante Vertragsauszüge und Nachträge, genaue Frage, betroffene Daten und bisherige Korrespondenz; keine vollständigen Personenakten im Entwurf.",
      subject: "Prüfung Ihrer Vertragsfrage",
      reply: "Bitte nennen Sie, soweit noch offen, die betreffende Vertragsstelle, die gewünschte Klärung und gegebenenfalls betroffene Daten.\n\nWir prüfen die Frage anhand der vereinbarten Unterlagen und holen erforderlichenfalls eine rechtliche Einordnung ein. Eine verbindliche Antwort wird nach dieser Prüfung vorbereitet. Zuständigkeit und Rückmeldedatum: [vor Versand festlegen].",
    },
  }[category];
  return {
    ...content,
    action: acute ? `Zuerst eine mögliche unmittelbare Gefahrenlage klären und die zuständige Notfallstelle einschalten, wenn erforderlich. Anschließend: ${content.action}` : content.action,
    message: `Betreff: ${content.subject}\n\nGuten Tag,\n\nSie bitten um Klärung des folgenden Sachverhalts:\n${description}\n\n${content.reply}\n\nFreundliche Grüße\n[Freigegebener Absender]`,
  };
}

function TenantPanel({ asset, assets, onSelect, onNotice }: Props) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TenantCategory>("maintenance");
  const [acute, setAcute] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<(ReturnType<typeof makeTenantDraft> & { fingerprint: string }) | null>(null);
  const assetFingerprint = JSON.stringify(asset);
  const fingerprint = JSON.stringify({ assetFingerprint, description, category, acute });
  const currentDraft = draft?.fingerprint === fingerprint ? draft : null;
  useEffect(() => { setDraft(null); }, [assetFingerprint]);

  function invalidate() { setDraft(null); setError(""); }
  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = description.trim();
    if (text.length < 12 || text.length > 2_000) {
      setDraft(null); setError("Bitte den anonymisierten Sachverhalt mit 12 bis 2.000 Zeichen beschreiben."); return;
    }
    setError("");
    setDraft({ ...makeTenantDraft(category, text, acute), fingerprint });
  }
  function exportDraft() {
    if (!currentDraft) return;
    const markdown = [
      "# Mietfall – Arbeitsentwurf", "", `Objektalias: ${asset.label} (${asset.id})`,
      `Kategorie: ${tenantCategories[category]}`, `Priorität: ${acute ? "Akute Gefahrenklärung" : "Reguläre Prüfung"}`, `Erstellt: ${today()}`,
      "", "## Sachverhalt laut Eingabe", description.trim(), "", "## Nächste Eigentümeraktion", currentDraft.action,
      "", "## Benötigte Belege", currentDraft.evidence, "", "## Kommunikationsentwurf", currentDraft.message,
      "", "## Vor Freigabe", "Sachverhalt, Zuständigkeit, konkrete Rückmeldefrist und erforderliche rechtliche Prüfung bestätigen. Empfänger und Absender erst im freigegebenen Versandkanal ergänzen.",
      "", "Status: Entwurf. Keine Nachricht versandt und kein Auftrag ausgelöst.",
      "", "Grundlage bei Zustandsfragen: BGB § 535 – https://www.gesetze-im-internet.de/bgb/__535.html", "",
    ].join("\n");
    downloadMarkdown(`mietfall-entwurf-${asset.id}-${today()}.md`, markdown);
    onNotice("Mietfall-Entwurf exportiert. Versand und Beauftragung bleiben offen.");
  }

  return <div className="pw-two-column">
    <section className="pw-panel">
      <span className="pw-tag teal">Eigentümeraktion vorbereiten</span>
      <h2 className="pw-panel-title">Sachverhalt, Zuständigkeit, Antwort.</h2>
      <form className="pw-form" onSubmit={createDraft} noValidate>
        <AssetSelect asset={asset} assets={assets} onSelect={onSelect} />
        <label>Fallart
          <select value={category} onChange={(event) => { setCategory(event.target.value as TenantCategory); invalidate(); }}>
            {Object.entries(tenantCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Anonymisierter Sachverhalt
          <textarea value={description} onChange={(event) => { setDescription(event.target.value); invalidate(); }} placeholder="Was ist wann festgestellt worden? Welche konkrete Klärung wird benötigt?" rows={6} minLength={12} maxLength={2_000} required />
        </label>
        <p className="pw-field-note">Ohne Namen, Adressen, Kontodaten oder Zugangscodes. Der Text bleibt in dieser Arbeitsfläche, bis du einen Export auslöst.</p>
        <label className="pw-check-label"><input type="checkbox" checked={acute} onChange={(event) => { setAcute(event.target.checked); invalidate(); }} />Akute Gefahr oder drohender erheblicher Schaden</label>
        {acute && <div className="pw-empty" role="status">
          <strong>Sicherung zuerst.</strong>
          <p>Bei unmittelbarer Gefahr den örtlichen Notruf oder zuständigen Notdienst einschalten. Art und Ort der Gefahr klären; sichere Erstmaßnahmen und Kontaktperson dokumentieren. Die Entwurfserstellung ist kein Notfallkanal.</p>
        </div>}
        {error && <p className="pw-form-error" role="alert">{error}</p>}
        <button type="submit" className="pw-button">Aktion und Antwort entwerfen</button>
      </form>
    </section>
    <section className="pw-panel">
      <span className="pw-tag amber">Entwurf · Freigabe offen</span>
      <h2 className="pw-panel-title">Nächster Schritt mit Belegbedarf.</h2>
      {currentDraft ? <>
        <h3>Eigentümeraktion</h3><p className="pw-prose">{currentDraft.action}</p>
        <h3>Benötigte Belege</h3><p className="pw-prose">{currentDraft.evidence}</p>
        <div className="pw-form"><label>Kommunikationsentwurf<textarea readOnly rows={12} value={currentDraft.message} /></label></div>
        <p className="pw-field-note">Vor Freigabe Fakten, Zuständigkeit, Rückmeldedatum und erforderliche rechtliche Prüfung ergänzen. Änderungen am Fall oder Objekt machen diesen Entwurf ungültig.</p>
        <button type="button" className="pw-button secondary" onClick={exportDraft}>Entwurf exportieren</button>
      </> : <div className="pw-empty"><p>Fallart und Sachverhalt bestimmen die nächste Aktion. Ein aktueller Entwurf erscheint nach der Prüfung deiner Eingaben.</p></div>}
      <p className="pw-field-note">Regelbasiert aus deinen Eingaben. Keine Nachricht versandt, kein Auftrag ausgelöst.</p>
    </section>
  </div>;
}

function ChatGptPanel({ onNotice }: Pick<Props, "onNotice">) {
  const [endpoint, setEndpoint] = useState("");
  const endpointInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setEndpoint(`${window.location.origin}/api/mcp`); }, []);

  async function copyEndpoint() {
    if (!endpoint) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(endpoint);
      onNotice("MCP-Adresse kopiert.");
    } catch {
      endpointInput.current?.focus();
      endpointInput.current?.select();
      onNotice("Adresse markiert. Mit Strg+C oder Cmd+C kopieren.");
    }
  }

  return <div className="pw-two-column">
    <section className="pw-panel">
      <span className="pw-tag teal">Drei MCP-Werkzeuge</span>
      <h2 className="pw-panel-title">Die Rechenlogik ins Gespräch holen.</h2>
      <p className="pw-prose">ChatGPT erhält Werkzeuge für nachvollziehbare Objektmodelle, Portfoliostress und strukturierte Eigentümerprüfungen.</p>
      <div className="pw-form">
        <label>MCP-Endpunkt dieses Deployments
          <input ref={endpointInput} className="pw-endpoint" type="text" readOnly value={endpoint} placeholder="Adresse wird ermittelt …" onFocus={(event) => event.currentTarget.select()} spellCheck={false} />
        </label>
        <button type="button" className="pw-button" disabled={!endpoint} onClick={copyEndpoint}>Endpunkt kopieren</button>
      </div>
      <ul className="pw-tool-list">
        <li><code>underwrite_property</code><p>Jahres-Cashflow, Tilgungsverlauf, Anschlussfinanzierung, Exit-Erlös, Eigenkapital-IRR und Kapitalwert aus expliziten Annahmen.</p></li>
        <li><code>stress_property_portfolio</code><p>Bis zu zwölf Objektmodelle mit Leerstand, Anschlusszins, Investitionskosten und Exit-Rendite im gemeinsamen Stressfall prüfen.</p></li>
        <li><code>get_property_review_playbook</code><p>Prüfverfahren, Belegbedarf und datierte Primärquellen für Erwerb, Eigentumsstruktur, Mietfälle und Kleinanzeigen abrufen.</p></li>
      </ul>
      <p className="pw-field-note">Die Berechnungen dieser Arbeitsfläche laufen im Browser. Ein Werkzeugaufruf aus ChatGPT überträgt die angegebenen Modellannahmen an den MCP-Endpunkt zur Berechnung. Der Dienst speichert diese Eingaben nicht und liest keine Eigentümer- oder Mieterdatenbank.</p>
    </section>
    <section className="pw-panel">
      <h2 className="pw-panel-title">Im eigenen ChatGPT verbinden.</h2>
      <ol className="pw-prose">
        <li>ChatGPT im Web öffnen. Unter <strong>Settings → Security and login</strong> den <strong>Developer mode</strong> aktivieren.</li>
        <li>Unter <strong>Plugins</strong> über die <strong>Plus-Schaltfläche</strong> eine Entwicklerverbindung erstellen. Name: <strong>Property Principal</strong>.</li>
        <li>Den vollständigen Endpunkt oben eintragen und <strong>No Authentication</strong> wählen. Er bietet Berechnungen und öffentliche Prüfverfahren.</li>
        <li>Die drei gefundenen Werkzeuge prüfen. In einem neuen Gespräch die Verbindung über die Developer-mode-Werkzeugauswahl aktivieren.</li>
        <li>Nach Änderungen am Dienst die Verbindungsmetadaten aktualisieren und in einem neuen Gespräch prüfen.</li>
      </ol>
      <p className="pw-field-note">Die Verbindung benötigt einen von ChatGPT erreichbaren HTTPS-Endpunkt. Ein durch Vercel Deployment Protection geschützter Preview-Link ist dafür nicht direkt geeignet.</p>
      <p className="pw-prose">OpenAI dokumentiert Developer mode für Pro, Plus, Business, Enterprise und Education im Web; die Freigabe hängt auch von Konto und Workspace-Richtlinien ab.</p>
      <p className="pw-field-note">Dies ist eine Entwicklerverbindung. Sie wird im Konto des Empfängers eingerichtet und ist kein veröffentlichter Verzeichniseintrag.</p>
      <a className="pw-button secondary" href="https://developers.openai.com/plugins/deploy/connect-chatgpt" target="_blank" rel="noreferrer">Offizielle Verbindungsanleitung ↗</a>
      <p className="pw-field-note"><a href="https://developers.openai.com/api/docs/guides/developer-mode" target="_blank" rel="noreferrer">Verfügbarkeit und Developer mode</a> · geprüft am 12.09.2026</p>
    </section>
  </div>;
}

export function PrincipalWorkflowPanels(props: Props) {
  if (props.section === "source") return <SourcePanel key={props.asset.id} {...props} />;
  if (props.section === "structure") return <StructurePanel key={props.asset.id} {...props} />;
  if (props.section === "tenants") return <TenantPanel key={props.asset.id} {...props} />;
  if (props.section === "chatgpt") return <ChatGptPanel onNotice={props.onNotice} />;
  return null;
}
