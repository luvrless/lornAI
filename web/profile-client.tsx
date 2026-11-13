/** @jsxRuntime automatic @jsxImportSource react */
/** Public profile page: hydrates the server-rendered profile. */
import { hydrateRoot } from "react-dom/client";
import { ProfileView, type Payload } from "./profile/ProfileView.tsx";
import "./profile/profile.css";

const el = document.getElementById("lp-root")!;
const data = JSON.parse(document.getElementById("lp-data")!.textContent!) as { payload: Payload; page: string | null };
hydrateRoot(el, <ProfileView payload={data.payload} mode="public" pageSlug={data.page} />);
