export interface Meeting {
  id: string;
  weddingId: string;
  title: string;
  meetingDate: string;
  vendorId: string | null;
  vendorName: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMeetingDto {
  title: string;
  meetingDate: string;
  vendorId?: string | null;
  notes?: string | null;
}

export type UpdateMeetingDto = Partial<CreateMeetingDto>;
