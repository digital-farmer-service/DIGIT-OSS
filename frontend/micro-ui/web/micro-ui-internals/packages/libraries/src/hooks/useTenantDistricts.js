import React from "react";
import { useQuery } from "react-query";
import { useTranslation } from "react-i18next";

const useTenantDistricts = (module, tenantId, config = {}) => {
  const { t } = useTranslation();

  return useQuery(["TENANT_DISTRICTS", module], () => Digit.LocationService.getLocalities(tenantId), {
    select: (data) => ({
      ddr: data?.boundarys
        ?.map((district) => ({
          ...district,
          ddrKey: t(`${district.name}`),
        }))
        .filter((item, i, arr) => i === arr.findIndex((t) => t.ddrKey === item.ddrKey)),
    }),
    ...config,
  });
};
export default useTenantDistricts;
