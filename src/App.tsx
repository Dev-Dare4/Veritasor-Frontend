import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LocaleProvider } from './i18n/provider'
import { ToastProvider } from './components/ToastContext'
import Layout from './components/Layout'
import { CookieConsentProvider } from './components/CookieConsentContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import OnboardingWizard from './pages/OnboardingWizard'
import Dashboard from './pages/Dashboard'
import Attestations from './pages/Attestations'
import AttestationDetail from './pages/AttestationDetail'
import NotFound from './pages/NotFound'
import ServerError from './pages/ServerError'
import ApiKeys from './pages/ApiKeys'
import HelpArticle from './pages/HelpArticle'
import RevenueSources from './pages/RevenueSources'
import Settings from './pages/Settings'
import ConsentPreferences from './pages/ConsentPreferences'
import {
  ConnectSourceWizard,
  SelectSourceProviderStep,
  AuthorizeSourceStep,
  OAuthCallbackLandingStep,
  ConfigureSourceScopeStep,
  MapCurrenciesStep,
  ConfirmSourceStep,
} from './pages/connect-source/ConnectSourceWizard'

/**
 * AppRoutes — the route tree without any router or locale wrapper.
 * Exported so tests can wrap it in MemoryRouter + IntlProvider directly.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route path="/500" element={<ServerError />} />
      <Route element={<Layout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="attestations" element={<Attestations />} />
        <Route path="attestations/:id" element={<AttestationDetail />} />
        <Route path="sources" element={<RevenueSources />} />
        <Route path="settings" element={<Settings />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="help" element={<HelpArticle />} />
        <Route path="consent-preferences" element={<ConsentPreferences />} />
        <Route path="connect-source" element={<ConnectSourceWizard />}>
          <Route path="provider" element={<SelectSourceProviderStep />} />
          <Route path="authorize" element={<AuthorizeSourceStep />} />
          <Route path="callback" element={<OAuthCallbackLandingStep />} />
          <Route path="scope" element={<ConfigureSourceScopeStep />} />
          <Route path="mapping" element={<MapCurrenciesStep />} />
          <Route path="confirm" element={<ConfirmSourceStep />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/** Production entry point — wraps AppRoutes in BrowserRouter + providers. */
export default function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <CookieConsentProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </CookieConsentProvider>
      </ToastProvider>
    </LocaleProvider>
  )
}
