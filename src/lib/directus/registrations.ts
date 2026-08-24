import { directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";

export interface PendingRegistration {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface PendingRegistrationRaw {
  id: string;
  email: string;
  display_name?: string | null;
  date_created: string;
}

export async function getPendingRegistrations(accessToken: string): Promise<PendingRegistration[]> {
  const response = await directusRequest<{ data: PendingRegistrationRaw[] }>(
    `${DIRECTUS_APP_ENDPOINT}/registrations`,
    { accessToken },
  );
  return response.data.map((item) => ({
    id: item.id,
    email: item.email,
    displayName: item.display_name?.trim() || "名称未設定",
    createdAt: item.date_created,
  }));
}

export async function acceptRegistration(id: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/registrations/${encodeURIComponent(id)}/accept`, {
    method: "POST",
    accessToken,
  });
}
