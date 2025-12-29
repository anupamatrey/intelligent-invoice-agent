package com.anupam.ruleengine.repository;

import com.anupam.ruleengine.entity.VendorServiceRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface VendorServiceRuleRepository extends JpaRepository<VendorServiceRule, Long> {
    
    Optional<VendorServiceRule> findByVendorCodeAndServiceName(String vendorCode, String serviceName);
    
    List<VendorServiceRule> findByVendorCode(String vendorCode);
    
    @Query("SELECT v FROM VendorServiceRule v WHERE v.vendorCode = :vendorCode AND v.serviceName = :serviceName AND v.isActive = true AND (v.effectiveTo IS NULL OR v.effectiveTo > CURRENT_TIMESTAMP)")
    Optional<VendorServiceRule> findActiveByVendorCodeAndServiceName(@Param("vendorCode") String vendorCode, @Param("serviceName") String serviceName);
    
    @Query("SELECT v FROM VendorServiceRule v WHERE v.vendorCode = :vendorCode AND v.isActive = true AND (v.effectiveTo IS NULL OR v.effectiveTo > CURRENT_TIMESTAMP)")
    List<VendorServiceRule> findActiveByVendorCode(@Param("vendorCode") String vendorCode);
}