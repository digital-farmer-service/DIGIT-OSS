import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader, Header } from "@egovernments/digit-ui-react-components";

import DesktopInbox from "../../components/DesktopInbox";
import MobileInbox from "../../components/MobileInbox";

const Inbox = () => {
  const { t } = useTranslation();
  const tenantId = Digit.ULBService.getCurrentTenantId();
  const { uuid , roles} = Digit.UserService.getUser().info;
  const [pageOffset, setPageOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isSystemUser, setIsSystemUser] = useState(false);
  const [searchParams, setSearchParams] = useState({ filters: { wfFilters: { assignee: [{ code: uuid }] }, wfQuery:{ assignee: uuid }}, search: "", sort: {} });

  useEffect(() => {
    (async () => {
      const applicationStatus = searchParams?.filters?.pgrfilters?.applicationStatus?.map((e) => e.code).join(",");
      let response = await Digit.PGRService.count(tenantId, applicationStatus?.length > 0 ? { applicationStatus } : {});
      if (response?.count) {
        setTotalRecords(response.count);
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    const getFiltersAccess = () => {
      const userRoles = roles?.map((roleData) => roleData?.code);
      const pgrRoles = ["SYSTEM_SUPPORT_USER"];
      const FILTERS_ACCESS = userRoles?.filter((role) => pgrRoles.includes(role));
      return FILTERS_ACCESS?.length > 0;
    };
    setIsSystemUser(getFiltersAccess());
  }, []);

  const fetchNextPage = () => {
    setPageOffset((prevState) => prevState + 10);
  };

  const fetchPrevPage = () => {
    setPageOffset((prevState) => prevState - 10);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
  };

  const handleFilterChange = (filterParam) => {
    setSearchParams({ ...searchParams, filters: filterParam });
  };

  const onSearch = (params = "") => {
    setSearchParams({ ...searchParams, search: params });
  };
  let complaints = [];
  let totalCount = 0;

  // let complaints = Digit.Hooks.pgr.useInboxData(searchParams) || [];
  let { data: complaintsObj , isLoading } = Digit.Hooks.pgr.useInboxData({ ...searchParams, offset: pageOffset, limit: pageSize });
  
  complaints = complaintsObj?.complaints;
  totalCount = complaintsObj?.totalCount;

  let isMobile = Digit.Utils.browser.isMobile();

  if (complaints?.length !== null) {
    if (isMobile) {
      return (
        <MobileInbox data={complaints} isLoading={isLoading} onFilterChange={handleFilterChange} onSearch={onSearch} searchParams={searchParams} />
      );
    } else {
      return (
        <div>
          <Header>{t("ES_COMMON_INBOX")}</Header>
          <DesktopInbox
            data={complaints}
            isLoading={isLoading}
            onFilterChange={handleFilterChange}
            onSearch={onSearch}
            searchParams={searchParams}
            onNextPage={fetchNextPage}
            onPrevPage={fetchPrevPage}
            onPageSizeChange={handlePageSizeChange}
            currentPage={Math.floor(pageOffset / pageSize)}
            totalRecords={isSystemUser ? totalRecords : totalCount}
            pageSizeLimit={pageSize}
            isSystemUser={isSystemUser}
          />
        </div>
      );
    }
  } else {
    return <Loader />;
  }
};

export default Inbox;
