import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "forgot" | "reset";

const features = ["Modélisation 3D", "Calculs structuraux", "Conformité réglementaire", "Suivi de projet"];

export default function AuthPage({ initialMode = "login" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialMode === "reset") setMode("reset");
  }, [initialMode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Connexion réussie.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) toast.success("Compte créé. Bienvenue sur GcBtp !");
        else {
          toast.success("Compte créé. Vérifiez votre e-mail pour confirmer votre adresse.");
          setMode("login");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        toast.success("Le lien de réinitialisation a été envoyé.");
        setMode("login");
      } else {
        if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Mot de passe mis à jour.");
        await supabase.auth.signOut();
        window.history.replaceState({}, "", window.location.pathname);
        setPassword("");
        setMode("login");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur d'authentification est survenue.";
      const normalized = message.toLowerCase();
      if (normalized.includes("invalid login credentials")) toast.error("E-mail ou mot de passe incorrect.");
      else if (normalized.includes("email not confirmed")) toast.error("Confirmez votre adresse e-mail avant de vous connecter.");
      else if (normalized.includes("user already registered")) toast.error("Un compte existe déjà avec cette adresse.");
      else toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion Google indisponible.");
      setBusy(false);
    }
  };

  const title = mode === "login" ? "Bon retour ! 👋" : mode === "signup" ? "Créer votre compte" : mode === "reset" ? "Nouveau mot de passe" : "Réinitialiser le mot de passe";
  const subtitle = mode === "login" ? "Connectez-vous à votre espace de travail." : mode === "signup" ? "Créez votre espace professionnel GcBtp en quelques secondes." : mode === "reset" ? "Choisissez un nouveau mot de passe sécurisé pour votre compte." : "Saisissez votre e-mail pour recevoir un lien sécurisé.";

  return (
    <main className="gcbtp-auth">
      <section className="gcbtp-auth-card">
        <div className="gcbtp-auth-visual">
          <div className="gcbtp-auth-visual-bg" />
          <div className="relative z-10 flex h-full flex-col p-7 text-white sm:p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 backdrop-blur"><Building2 className="h-6 w-6" /></div>
              <div><div className="text-[25px] font-extrabold tracking-tight">GcBtp</div><div className="text-xs text-white/80">Construire mieux, plus intelligemment</div></div>
            </div>
            <div className="mt-auto max-w-md pb-4">
              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Bureau d'études digital</div>
              <h1 className="text-3xl font-extrabold leading-tight sm:text-[38px]">Votre partenaire pour des projets de construction solides</h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/80">Concevez, analysez et optimisez vos bâtiments avec des outils professionnels de calcul structural et de conception en béton armé.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {features.map(feature => <div key={feature} className="flex items-center gap-2 text-xs font-semibold text-white/90"><span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15"><Check className="h-3.5 w-3.5" /></span>{feature}</div>)}
              </div>
            </div>
          </div>
        </div>

        <div className="gcbtp-auth-form">
          <div className="mb-8 flex items-center justify-end gap-2 text-[11px] font-semibold text-[#71808a]"><span className="h-2 w-2 rounded-full bg-[#3ecf8e]" />Propulsé par <span className="font-extrabold text-[#102f45]">Supabase</span></div>
          <div className="mx-auto w-full max-w-[460px]">
            <div className="mb-8"><h2 className="text-[31px] font-extrabold tracking-[-0.04em] text-[#102f45]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#71808a]">{subtitle}</p></div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && <label className="block"><span className="mb-2 block text-xs font-bold text-[#344c5b]">Nom complet</span><div className="relative"><Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9ba4]" /><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Votre nom" className="gcbtp-auth-input pl-11" autoComplete="name" /></div></label>}
              {mode !== "reset" && <label className="block"><span className="mb-2 block text-xs font-bold text-[#344c5b]">Adresse e-mail</span><div className="relative"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9ba4]" /><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" className="gcbtp-auth-input pl-11" autoComplete="email" /></div></label>}
              {mode !== "forgot" && <label className="block"><span className="mb-2 block text-xs font-bold text-[#344c5b]">Mot de passe</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9ba4]" /><input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" className="gcbtp-auth-input pl-11 pr-12" autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"} /><button type="button" aria-label="Afficher ou masquer le mot de passe" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#71808a] hover:bg-[#f1f4f6]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>}

              {mode === "login" && <div className="flex items-center justify-end py-1 text-xs"><button type="button" onClick={() => setMode("forgot")} className="font-bold text-[#2864e8] hover:underline">Mot de passe oublié ?</button></div>}
              <button disabled={busy} className="gcbtp-auth-primary" type="submit">{busy ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : mode === "reset" ? "Enregistrer le nouveau mot de passe" : "Envoyer le lien"}{!busy && <ArrowRight className="h-4 w-4" />}</button>
            </form>

            {(mode === "login" || mode === "signup") && <><div className="my-6 flex items-center gap-4 text-[11px] font-bold text-[#9aa6ad]"><div className="h-px flex-1 bg-[#e3e9ed]" /><span>OU</span><div className="h-px flex-1 bg-[#e3e9ed]" /></div><button disabled={busy} type="button" onClick={googleLogin} className="gcbtp-auth-google"><span className="text-lg font-extrabold">G</span> Continuer avec Google</button></>}

            <div className="mt-8 text-center text-sm text-[#71808a]">
              {mode === "login" ? <>Vous n'avez pas de compte ? <button type="button" onClick={() => setMode("signup")} className="font-bold text-[#2864e8] hover:underline">Créer un compte</button></> : <button type="button" onClick={() => setMode("login")} className="font-bold text-[#2864e8] hover:underline">← Retour à la connexion</button>}
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-semibold text-[#9aa6ad]"><ShieldCheck className="h-3.5 w-3.5" />Authentification sécurisée · vos projets restent privés</div>
          </div>
        </div>
      </section>
    </main>
  );
}
