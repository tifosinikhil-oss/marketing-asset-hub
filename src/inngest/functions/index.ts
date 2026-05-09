import { notifyRequestSubmitted } from "./notify-submitted";
import { notifyStatusChanged } from "./notify-status-changed";
import { generateWbsOnSubmit } from "./generate-wbs";

export const functions = [notifyRequestSubmitted, notifyStatusChanged, generateWbsOnSubmit];
