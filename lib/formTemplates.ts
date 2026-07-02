import type { FormFieldSpec, FormFieldType } from './formBuilder';

/**
 * Professional, ready-to-use form templates. Loading one pre-fills the wizard;
 * every field stays fully editable afterwards.
 */

type TemplateField = Omit<FormFieldSpec, 'id'>;

export interface FormTemplate {
  id: string;
  name: string;
  audience: string;
  /** small emoji used in the gallery */
  emoji: string;
  title: string;
  /** suggested file name (without .pdf) */
  fileName: string;
  /** reserve a passport-photo box in the header */
  photoBox: boolean;
  fields: TemplateField[];
}

const f = (
  label: string,
  type: FormFieldType = 'text',
  extra: Partial<TemplateField> = {},
): TemplateField => ({
  label,
  type,
  required: false,
  defaultValue: '',
  options: [],
  ...extra,
});

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'school-admission',
    name: 'School Admission',
    audience: 'Schools & colleges',
    emoji: '🎓',
    title: 'Student Admission Form',
    fileName: 'school-admission-form',
    photoBox: true,
    fields: [
      f('Student full name', 'text', { required: true }),
      f('Date of birth', 'date', { required: true }),
      f('Gender', 'radio', { options: ['Male', 'Female', 'Other'] }),
      f('Class / grade applying for', 'dropdown', {
        required: true,
        options: ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      }),
      f('Previous school (if any)'),
      f('Parent / guardian name', 'text', { required: true }),
      f('Parent phone', 'phone', { required: true }),
      f('Parent email', 'email'),
      f('Residential address', 'multiline', { required: true }),
      f('School transport required', 'checkbox'),
    ],
  },
  {
    id: 'patient-registration',
    name: 'Patient Registration',
    audience: 'Hospitals & clinics',
    emoji: '🏥',
    title: 'Patient Registration Form',
    fileName: 'patient-registration-form',
    photoBox: false,
    fields: [
      f('Patient full name', 'text', { required: true }),
      f('Date of birth', 'date', { required: true }),
      f('Gender', 'radio', { options: ['Male', 'Female', 'Other'] }),
      f('Blood group', 'dropdown', {
        options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
      }),
      f('Phone', 'phone', { required: true }),
      f('Emergency contact (name & phone)', 'text', { required: true }),
      f('Address', 'multiline'),
      f('Known allergies / current medication', 'multiline'),
      f('Insurance provider'),
      f('Policy number'),
      f('I consent to treatment and data storage', 'checkbox', { required: true }),
    ],
  },
  {
    id: 'job-application',
    name: 'Job Application',
    audience: 'HR & recruitment',
    emoji: '💼',
    title: 'Job Application Form',
    fileName: 'job-application-form',
    photoBox: true,
    fields: [
      f('Full name', 'text', { required: true }),
      f('Email', 'email', { required: true }),
      f('Phone', 'phone', { required: true }),
      f('Position applied for', 'text', { required: true }),
      f('Total experience (years)', 'number'),
      f('Current / last employer'),
      f('Expected salary', 'number'),
      f('Earliest start date', 'date'),
      f('Highest qualification', 'dropdown', {
        options: ['High school', 'Diploma', "Bachelor's", "Master's", 'Doctorate'],
      }),
      f('Why should we hire you?', 'multiline'),
    ],
  },
  {
    id: 'leave-application',
    name: 'Leave Application',
    audience: 'Offices & HR',
    emoji: '🗓️',
    title: 'Employee Leave Application',
    fileName: 'leave-application-form',
    photoBox: false,
    fields: [
      f('Employee name', 'text', { required: true }),
      f('Employee ID', 'text', { required: true }),
      f('Department'),
      f('Leave type', 'radio', {
        required: true,
        options: ['Casual', 'Sick', 'Earned', 'Maternity/Paternity', 'Unpaid'],
      }),
      f('From date', 'date', { required: true }),
      f('To date', 'date', { required: true }),
      f('Number of days', 'number'),
      f('Reason for leave', 'multiline'),
      f('Work handover to'),
    ],
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    audience: 'Events & conferences',
    emoji: '🎟️',
    title: 'Event Registration Form',
    fileName: 'event-registration-form',
    photoBox: false,
    fields: [
      f('Attendee name', 'text', { required: true }),
      f('Email', 'email', { required: true }),
      f('Phone', 'phone'),
      f('Organization / institute'),
      f('Ticket type', 'radio', { options: ['Standard', 'VIP', 'Student'] }),
      f('Dietary preference', 'dropdown', {
        options: ['No preference', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free'],
      }),
      f('T-shirt size', 'dropdown', { options: ['S', 'M', 'L', 'XL', 'XXL'] }),
      f('I agree to be photographed at the event', 'checkbox'),
    ],
  },
  {
    id: 'customer-feedback',
    name: 'Customer Feedback',
    audience: 'Retail & services',
    emoji: '⭐',
    title: 'Customer Feedback Form',
    fileName: 'customer-feedback-form',
    photoBox: false,
    fields: [
      f('Name'),
      f('Email', 'email'),
      f('Date of visit', 'date'),
      f('Overall experience', 'radio', {
        required: true,
        options: ['Excellent', 'Good', 'Average', 'Poor'],
      }),
      f('Staff friendliness', 'radio', { options: ['Excellent', 'Good', 'Average', 'Poor'] }),
      f('Would you recommend us?', 'checkbox'),
      f('Comments & suggestions', 'multiline'),
    ],
  },
  {
    id: 'hotel-registration',
    name: 'Hotel Guest Registration',
    audience: 'Hotels & lodges',
    emoji: '🏨',
    title: 'Guest Registration Card',
    fileName: 'hotel-guest-registration',
    photoBox: false,
    fields: [
      f('Guest full name', 'text', { required: true }),
      f('Nationality'),
      f('ID type', 'dropdown', {
        required: true,
        options: ['Passport', 'National ID', 'Driving licence', 'Other'],
      }),
      f('ID number', 'text', { required: true }),
      f('Check-in date', 'date', { required: true }),
      f('Check-out date', 'date', { required: true }),
      f('Room type', 'dropdown', { options: ['Standard', 'Deluxe', 'Suite', 'Family'] }),
      f('Number of guests', 'number'),
      f('Phone', 'phone', { required: true }),
      f('Email', 'email'),
    ],
  },
  {
    id: 'gym-membership',
    name: 'Gym Membership',
    audience: 'Gyms & fitness studios',
    emoji: '🏋️',
    title: 'Gym Membership Application',
    fileName: 'gym-membership-form',
    photoBox: true,
    fields: [
      f('Full name', 'text', { required: true }),
      f('Date of birth', 'date', { required: true }),
      f('Phone', 'phone', { required: true }),
      f('Email', 'email'),
      f('Membership plan', 'radio', {
        required: true,
        options: ['Monthly', 'Quarterly', 'Half-yearly', 'Annual'],
      }),
      f('Preferred start date', 'date'),
      f('Medical conditions / injuries', 'multiline'),
      f('Emergency contact (name & phone)', 'text', { required: true }),
      f('I accept the terms and safety rules', 'checkbox', { required: true }),
    ],
  },
  {
    id: 'bank-kyc',
    name: 'Account Opening / KYC',
    audience: 'Banks & finance',
    emoji: '🏦',
    title: 'Account Opening & KYC Form',
    fileName: 'account-opening-kyc-form',
    photoBox: true,
    fields: [
      f('Applicant full name', 'text', { required: true }),
      f('Date of birth', 'date', { required: true }),
      f('Tax ID / PAN', 'text', { required: true }),
      f('Phone', 'phone', { required: true }),
      f('Email', 'email'),
      f('Residential address', 'multiline', { required: true }),
      f('Account type', 'radio', { required: true, options: ['Savings', 'Current', 'Salary'] }),
      f('Occupation', 'dropdown', {
        options: ['Salaried', 'Self-employed', 'Business', 'Student', 'Retired', 'Other'],
      }),
      f('Annual income range', 'dropdown', {
        options: ['Below 2.5L', '2.5L – 5L', '5L – 10L', '10L – 25L', 'Above 25L'],
      }),
      f('Nominee name'),
      f('I declare the above information is true', 'checkbox', { required: true }),
    ],
  },
  {
    id: 'clinic-appointment',
    name: 'Appointment Request',
    audience: 'Clinics & practices',
    emoji: '🩺',
    title: 'Appointment Request Form',
    fileName: 'appointment-request-form',
    photoBox: false,
    fields: [
      f('Patient name', 'text', { required: true }),
      f('Date of birth', 'date'),
      f('Phone', 'phone', { required: true }),
      f('Department / doctor', 'dropdown', {
        options: ['General medicine', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Dental', 'ENT'],
      }),
      f('Preferred date', 'date', { required: true }),
      f('Preferred time', 'time'),
      f('Reason for visit', 'multiline'),
      f('First visit to this clinic', 'checkbox'),
    ],
  },
];
