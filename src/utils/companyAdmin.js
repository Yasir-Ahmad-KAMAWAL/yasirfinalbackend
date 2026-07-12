import { Company } from "../models/Company.model.js";

export const isUserCompanyAdmin = (userId, company) => {
  if (!company || !userId) return false;
  return (
    company.owner.toString() === userId.toString() ||
    company.admins.some((adminId) => adminId.toString() === userId.toString())
  );
};

export const getCompanyAdminStatus = async (userId, companyId) => {
  if (!companyId) return { company: null, isAdmin: false };

  const company = await Company.findById(companyId);
  return {
    company,
    isAdmin: isUserCompanyAdmin(userId, company),
  };
};
